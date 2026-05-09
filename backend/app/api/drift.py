"""Drift event endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.models import DriftEvent, ProductionSample, BehaviorUnit, BehaviorVersion
from app.services.alert_service import alert_service
from app.core.idempotency import build_idempotency_key, claim_idempotency_key
from app.schemas.schemas import ProductionSampleRequest
import uuid
from datetime import datetime
import numpy as np


router = APIRouter(prefix="/drift", tags=["drift"])


def _calculate_drift_score(embedding: Optional[list[float]], recent_embeddings: list[list[float]]) -> float:
    """Calculate a lightweight drift score for the demo path."""
    if not embedding or not recent_embeddings:
        return 0.18

    try:
        sample = np.asarray(embedding, dtype=float)
        baselines = np.asarray(recent_embeddings, dtype=float)
        if baselines.ndim == 1:
            baselines = baselines.reshape(1, -1)

        distances = np.linalg.norm(baselines - sample, axis=1)
        return float(np.clip(distances.mean(), 0.0, 1.0))
    except Exception:
        return 0.18


def _severity_from_score(score: float) -> str:
    """Map a numeric drift score to a severity label."""
    if score >= 0.75:
        return "critical"
    if score >= 0.5:
        return "high"
    if score >= 0.25:
        return "medium"
    return "low"


class DriftEventResponse(BaseModel):
    """Drift event response."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    unit_id: str
    version_id: Optional[str]
    severity: str
    drift_score: float
    details: dict
    root_cause: Optional[dict]
    resolved: bool
    created_at: datetime


@router.get("/events", response_model=List[DriftEventResponse])
async def list_drift_events(
    unit_id: Optional[str] = None,
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List drift events for org with optional filters."""
    org_id = uuid.UUID(current["org_id"])

    # Build query with filters and org isolation.
    stmt = (
        select(DriftEvent)
        .join(BehaviorUnit, BehaviorUnit.id == DriftEvent.unit_id)
        .where(BehaviorUnit.org_id == org_id)
    )
    filters = []
    
    if unit_id:
        filters.append(DriftEvent.unit_id == uuid.UUID(unit_id))
    if severity:
        filters.append(DriftEvent.severity == severity)
    if resolved is not None:
        filters.append(DriftEvent.resolved == resolved)
    
    if filters:
        stmt = stmt.where(*filters)
    
    stmt = stmt.order_by(desc(DriftEvent.created_at))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/events/{event_id}", response_model=DriftEventResponse)
async def get_drift_event(
    event_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get drift event details."""
    event_uuid = uuid.UUID(event_id)
    org_id = uuid.UUID(current["org_id"])
    stmt = (
        select(DriftEvent)
        .join(BehaviorUnit, BehaviorUnit.id == DriftEvent.unit_id)
        .where((DriftEvent.id == event_uuid) & (BehaviorUnit.org_id == org_id))
    )
    result = await db.execute(stmt)
    event = result.scalars().first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return event


@router.post("/events/{event_id}/resolve")
async def resolve_drift_event(
    event_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a drift event as resolved."""
    event_uuid = uuid.UUID(event_id)
    org_id = uuid.UUID(current["org_id"])
    stmt = (
        select(DriftEvent)
        .join(BehaviorUnit, BehaviorUnit.id == DriftEvent.unit_id)
        .where((DriftEvent.id == event_uuid) & (BehaviorUnit.org_id == org_id))
    )
    result = await db.execute(stmt)
    event = result.scalars().first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event.resolved = True
    event.resolved_at = datetime.utcnow()
    await db.commit()
    
    return {"status": "resolved"}


@router.post("/ingest/output")
async def ingest_production_output(
    request: ProductionSampleRequest,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest production output sample for drift detection."""
    unit_id = uuid.UUID(request.unit_id)
    org_id = uuid.UUID(current["org_id"])

    idempotency_key = build_idempotency_key(
        "drift.ingest",
        explicit_key=request.idempotency_key,
        payload={
            "unit_id": request.unit_id,
            "input_text": request.input_text,
            "output_text": request.output_text,
            "embedding": request.embedding,
        },
    )
    claimed = await claim_idempotency_key(idempotency_key)
    if claimed.is_duplicate:
        raise HTTPException(status_code=409, detail="Duplicate ingestion request")
    
    # Verify unit exists
    stmt = select(BehaviorUnit).where(
        (BehaviorUnit.id == unit_id) & (BehaviorUnit.org_id == org_id)
    )
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Unit not found")

    baseline_stmt = (
        select(ProductionSample.embedding)
        .where(ProductionSample.unit_id == unit_id)
        .order_by(desc(ProductionSample.created_at))
        .limit(10)
    )
    baseline_result = await db.execute(baseline_stmt)
    recent_embeddings = [row[0] for row in baseline_result.all() if row[0]]

    latest_version_stmt = (
        select(BehaviorVersion)
        .where(BehaviorVersion.unit_id == unit_id)
        .order_by(desc(BehaviorVersion.version_number))
        .limit(1)
    )
    latest_version_result = await db.execute(latest_version_stmt)
    latest_version = latest_version_result.scalars().first()
    
    sample = ProductionSample(
        id=uuid.uuid4(),
        unit_id=unit_id,
        input_text=request.input_text,
        output_text=request.output_text,
        embedding=request.embedding,
    )
    db.add(sample)

    drift_score = _calculate_drift_score(request.embedding, recent_embeddings)
    severity = _severity_from_score(drift_score)

    drift_event = DriftEvent(
        id=uuid.uuid4(),
        unit_id=unit_id,
        version_id=latest_version.id if latest_version else None,
        severity=severity,
        drift_score=drift_score,
        details={
            "sample_id": str(sample.id),
            "input_text": request.input_text,
            "output_text": request.output_text,
            "embedding_provided": bool(request.embedding),
            "recent_samples_considered": len(recent_embeddings),
        },
        root_cause={
            "most_likely_cause": "Behavior shift detected from recent production samples",
            "confidence": round(min(0.95, max(0.25, drift_score)), 2),
            "recommended_action": "Review the latest version and compare it against the current eval set",
        },
    )

    db.add(drift_event)
    await db.commit()
    
    try:
        from app.main import broadcast_drift_event

        await broadcast_drift_event(
            str(org_id),
            {
                "type": "drift_event",
                "event": {
                    "id": str(drift_event.id),
                    "unit_id": str(unit_id),
                    "severity": severity,
                    "drift_score": drift_score,
                    "resolved": False,
                    "created_at": drift_event.created_at.isoformat() if drift_event.created_at else None,
                },
            },
        )
    except Exception:
        # Broadcasting is best-effort for the demo.
        pass

    alert_summary = await alert_service.dispatch_drift_alerts(
        db=db,
        org_id=org_id,
        drift_event=drift_event,
    )
    
    return {
        "sample_id": str(sample.id),
        "drift_event_id": str(drift_event.id),
        "severity": severity,
        "drift_score": drift_score,
        "alerts": alert_summary,
    }
