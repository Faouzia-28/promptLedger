"""Compliance and audit endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import List, Optional
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.models import AuditLog, DriftEvent, BehaviorUnit, BehaviorVersion
from app.services.compliance_report import compliance_report_service
import uuid
from datetime import datetime


router = APIRouter(prefix="/compliance", tags=["compliance"])


class AuditLogResponse(BaseModel):
    """Audit log response."""
    id: str
    org_id: str
    action: str
    actor_id: Optional[str]
    resource_type: str
    resource_id: str
    metadata_: dict
    created_at: datetime


@router.get("/audit-log", response_model=List[AuditLogResponse])
async def get_audit_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated audit log for org."""
    org_id = uuid.UUID(current["org_id"])

    stmt = select(AuditLog).where(
        AuditLog.org_id == org_id
    ).order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)

    result = await db.execute(stmt)
    entries = result.scalars().all()
    return [
        {
            "id": str(entry.id),
            "org_id": str(entry.org_id),
            "action": entry.action,
            "actor_id": str(entry.actor_id) if entry.actor_id else None,
            "resource_type": entry.resource_type,
            "resource_id": entry.resource_id,
            "metadata_": entry.metadata_ or {},
            "created_at": entry.created_at,
        }
        for entry in entries
    ]


@router.get("/export")
async def export_compliance(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    export_format: str = Query("json", pattern="^(json|ndjson)$"),
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate compliance export (audit log + metadata)."""
    org_id = uuid.UUID(current["org_id"])

    audit_stmt = select(AuditLog).where(AuditLog.org_id == org_id).order_by(desc(AuditLog.created_at))
    drift_stmt = (
        select(DriftEvent)
        .join(BehaviorUnit, BehaviorUnit.id == DriftEvent.unit_id)
        .where(BehaviorUnit.org_id == org_id)
        .order_by(desc(DriftEvent.created_at))
    )

    audit_result = await db.execute(audit_stmt)
    drift_result = await db.execute(drift_stmt)

    audit_entries = audit_result.scalars().all()
    drift_events = drift_result.scalars().all()

    payload = compliance_report_service.build_export_payload(
        org_id=org_id,
        audit_entries=audit_entries,
        drift_events=drift_events,
        start_date=start_date,
        end_date=end_date,
    )

    if export_format == "ndjson":
        _ = compliance_report_service.to_ndjson_bytes(payload)
    else:
        _ = compliance_report_service.to_json_bytes(payload)

    return {
        "status": "export_generated",
        "download_url": f"/api/v1/compliance/exports/{org_id}.{export_format}",
        "format": export_format,
        "payload": payload,
    }


@router.get("/eu-ai-act-report")
async def get_eu_ai_act_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate EU AI Act compliance report."""
    org_id = uuid.UUID(current["org_id"])

    units_result = await db.execute(select(BehaviorUnit).where(BehaviorUnit.org_id == org_id))
    units = units_result.scalars().all()
    audit_result = await db.execute(select(AuditLog).where(AuditLog.org_id == org_id))
    audit_entries = audit_result.scalars().all()
    active_versions_result = await db.execute(
        select(BehaviorVersion.id)
        .join(BehaviorUnit, BehaviorUnit.id == BehaviorVersion.unit_id)
        .where(BehaviorUnit.org_id == org_id)
    )
    active_versions = len(active_versions_result.scalars().all())
    drift_result = await db.execute(
        select(DriftEvent)
        .join(BehaviorUnit, BehaviorUnit.id == DriftEvent.unit_id)
        .where(BehaviorUnit.org_id == org_id)
    )
    drift_events = drift_result.scalars().all()

    open_events = [event for event in drift_events if not event.resolved]
    critical_events = [event for event in drift_events if event.severity == "critical"]

    return {
        "report_type": "EU AI Act",
        "organization_id": current["org_id"],
        "period": {
            "start": start_date or datetime.utcnow(),
            "end": end_date or datetime.utcnow(),
        },
        "sections": {
            "model_deployment": {
                "units_registered": len(units),
                "active_versions": active_versions,
            },
            "monitoring": {
                "audit_events": len(audit_entries),
                "drift_events": len(drift_events),
                "open_alerts": len(open_events),
            },
            "incident_response": {
                "critical_drift_events": len(critical_events),
                "resolved_events": len([event for event in drift_events if event.resolved]),
            },
        },
    }
