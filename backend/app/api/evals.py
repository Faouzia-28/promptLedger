"""Evaluation endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.models import EvalSet, EvalRun, BehaviorVersion
import uuid
from datetime import datetime


router = APIRouter(prefix="/evals", tags=["evals"])


class EvalSetCreateRequest(BaseModel):
    """Create eval set request."""
    unit_id: str
    name: str
    cases: list[dict]  # [{"input": "...", "expected_output": "...", "criteria": "..."}]


class EvalSetResponse(BaseModel):
    """Eval set response."""
    id: str
    org_id: str
    unit_id: str
    name: str
    cases: list[dict]
    created_at: datetime


class EvalRunResponse(BaseModel):
    """Eval run response."""
    id: str
    version_id: str
    eval_set_id: str
    status: str
    results: Optional[list[dict]] = None
    score: Optional[float] = None
    triggered_by: str
    created_at: datetime
    completed_at: Optional[datetime] = None


def serialize_eval_set(eval_set: EvalSet) -> dict:
    return {
        "id": str(eval_set.id),
        "org_id": str(eval_set.org_id),
        "unit_id": str(eval_set.unit_id),
        "name": eval_set.name,
        "cases": eval_set.cases,
        "created_at": eval_set.created_at,
    }


def serialize_eval_run(run: EvalRun) -> dict:
    return {
        "id": str(run.id),
        "version_id": str(run.version_id),
        "eval_set_id": str(run.eval_set_id),
        "status": run.status,
        "results": run.results,
        "score": run.score,
        "triggered_by": str(run.triggered_by),
        "created_at": run.created_at,
        "completed_at": run.completed_at,
    }


@router.post("/sets", response_model=EvalSetResponse)
async def create_eval_set(
    request: EvalSetCreateRequest,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new evaluation set."""
    org_id = uuid.UUID(current["org_id"])
    unit_id = uuid.UUID(request.unit_id)
    
    eval_set = EvalSet(
        id=uuid.uuid4(),
        org_id=org_id,
        unit_id=unit_id,
        name=request.name,
        cases=request.cases,
    )
    db.add(eval_set)
    await db.commit()
    await db.refresh(eval_set)
    return serialize_eval_set(eval_set)


@router.get("/sets", response_model=List[EvalSetResponse])
async def list_eval_sets(
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List eval sets for current org."""
    org_id = uuid.UUID(current["org_id"])
    stmt = select(EvalSet).where(EvalSet.org_id == org_id)
    result = await db.execute(stmt)
    return [serialize_eval_set(eval_set) for eval_set in result.scalars().all()]


class EvalRunCreateResponse(BaseModel):
    """Eval run creation response."""
    run_id: str


@router.post("/runs", response_model=EvalRunCreateResponse)
async def create_eval_run(
    version_id: str,
    eval_set_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create and queue an evaluation run."""
    version_uuid = uuid.UUID(version_id)
    eval_set_uuid = uuid.UUID(eval_set_id)
    
    run = EvalRun(
        id=uuid.uuid4(),
        version_id=version_uuid,
        eval_set_id=eval_set_uuid,
        status="pending",
        triggered_by=current["user_id"],
    )
    db.add(run)
    await db.commit()
    
    # Queue Celery task to run evaluation
    from app.workers.tasks import run_regression_eval
    run_regression_eval.delay(str(run.id))
    
    return {"run_id": str(run.id)}


@router.get("/runs/{run_id}", response_model=EvalRunResponse)
async def get_eval_run(
    run_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get evaluation run status and results."""
    run_uuid = uuid.UUID(run_id)
    stmt = select(EvalRun).where(EvalRun.id == run_uuid)
    result = await db.execute(stmt)
    run = result.scalars().first()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return serialize_eval_run(run)


@router.get("/units/{unit_id}/runs", response_model=List[EvalRunResponse])
async def list_unit_eval_runs(
    unit_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all eval runs for a specific behavior unit."""
    unit_uuid = uuid.UUID(unit_id)
    
    # Get all versions for this unit
    version_stmt = select(BehaviorVersion).where(BehaviorVersion.unit_id == unit_uuid)
    version_result = await db.execute(version_stmt)
    versions = version_result.scalars().all()
    version_ids = [v.id for v in versions]
    
    if not version_ids:
        return []
    
    # Get all runs for these versions
    run_stmt = select(EvalRun).where(EvalRun.version_id.in_(version_ids)).order_by(desc(EvalRun.created_at))
    run_result = await db.execute(run_stmt)
    return [serialize_eval_run(run) for run in run_result.scalars().all()]
