"""Behavior unit endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.models import BehaviorUnit, BehaviorVersion, EvalSet, User
from app.agents.compliance_agent import compliance_agent
from app.agents.semantic_diff_agent import semantic_diff_agent
from app.services.fingerprint_service import fingerprint_service
import uuid
from datetime import datetime


router = APIRouter(prefix="/units", tags=["units"])


class BehaviorVersionBase(BaseModel):
    """Base behavior version schema."""
    content: dict
    config: Optional[dict] = None  # Renamed from model_config to avoid Pydantic conflict
    git_commit: Optional[str] = None
    git_branch: Optional[str] = None


class BehaviorVersionResponse(BehaviorVersionBase):
    """Behavior version response."""
    id: str
    unit_id: str
    version_number: int
    status: str
    behavioral_fingerprint: Optional[list[float]] = None
    created_by: Optional[str] = None
    created_at: datetime


class BehaviorUnitBase(BaseModel):
    """Base behavior unit schema."""
    name: str
    description: Optional[str] = None
    unit_type: str = "llm"


class BehaviorUnitResponse(BehaviorUnitBase):
    """Behavior unit response."""
    id: str
    org_id: str
    created_at: datetime


class BehaviorUnitDetailResponse(BehaviorUnitResponse):
    """Behavior unit with latest version."""
    latest_version: Optional[BehaviorVersionResponse] = None


def serialize_behavior_version(version: BehaviorVersion) -> dict:
    return {
        "id": str(version.id),
        "unit_id": str(version.unit_id),
        "version_number": version.version_number,
        "content": version.content,
        "config": version.model_config,
        "git_commit": version.git_commit,
        "git_branch": version.git_branch,
        "status": version.status,
        "behavioral_fingerprint": version.behavioral_fingerprint,
        "created_by": str(version.created_by) if version.created_by else None,
        "created_at": version.created_at,
    }


def serialize_behavior_unit(unit: BehaviorUnit, latest_version: Optional[BehaviorVersion] = None) -> dict:
    payload = {
        "id": str(unit.id),
        "name": unit.name,
        "description": unit.description,
        "unit_type": unit.unit_type,
        "org_id": str(unit.org_id),
        "created_at": unit.created_at,
    }
    if latest_version is not None:
        payload["latest_version"] = serialize_behavior_version(latest_version)
    return payload


@router.get("", response_model=List[BehaviorUnitResponse])
async def list_units(
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all behavior units for current org."""
    org_id = uuid.UUID(current["org_id"])
    stmt = select(BehaviorUnit).where(BehaviorUnit.org_id == org_id)
    result = await db.execute(stmt)
    units = result.scalars().all()
    return [serialize_behavior_unit(unit) for unit in units]


@router.post("", response_model=BehaviorUnitResponse)
async def create_unit(
    request: BehaviorUnitBase,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new behavior unit."""
    org_id = uuid.UUID(current["org_id"])
    user_id = uuid.UUID(current["user_id"])
    
    unit = BehaviorUnit(
        id=uuid.uuid4(),
        org_id=org_id,
        name=request.name,
        description=request.description,
        unit_type=request.unit_type,
    )
    db.add(unit)
    await db.commit()
    await db.refresh(unit)
    
    # Audit log
    await compliance_agent.write_audit_log(
        db, action='create_unit', actor_id=user_id, org_id=org_id,
        resource_type='BehaviorUnit', resource_id=str(unit.id),
        metadata={'name': request.name, 'type': request.unit_type}
    )
    
    return serialize_behavior_unit(unit)


@router.get("/{unit_id}", response_model=BehaviorUnitDetailResponse)
async def get_unit(
    unit_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a behavior unit with latest version."""
    unit_uuid = uuid.UUID(unit_id)
    org_id = uuid.UUID(current["org_id"])
    
    stmt = select(BehaviorUnit).where(
        (BehaviorUnit.id == unit_uuid) & (BehaviorUnit.org_id == org_id)
    )
    result = await db.execute(stmt)
    unit = result.scalars().first()
    
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Get latest version
    version_stmt = select(BehaviorVersion).where(
        BehaviorVersion.unit_id == unit_uuid
    ).order_by(desc(BehaviorVersion.version_number)).limit(1)
    version_result = await db.execute(version_stmt)
    latest_version = version_result.scalars().first()
    
    return serialize_behavior_unit(unit, latest_version)


@router.post("/{unit_id}/versions", response_model=BehaviorVersionResponse)
async def create_version(
    unit_id: str,
    request: BehaviorVersionBase,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new version of a behavior unit."""
    unit_uuid = uuid.UUID(unit_id)
    org_id = uuid.UUID(current["org_id"])
    user_id = uuid.UUID(current["user_id"])
    
    # Verify unit exists and belongs to org
    stmt = select(BehaviorUnit).where(
        (BehaviorUnit.id == unit_uuid) & (BehaviorUnit.org_id == org_id)
    )
    result = await db.execute(stmt)
    unit = result.scalars().first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Get next version number
    version_stmt = select(BehaviorVersion).where(
        BehaviorVersion.unit_id == unit_uuid
    ).order_by(desc(BehaviorVersion.version_number)).limit(1)
    version_result = await db.execute(version_stmt)
    latest = version_result.scalars().first()
    next_version = (latest.version_number if latest else 0) + 1
    
    version = BehaviorVersion(
        id=uuid.uuid4(),
        unit_id=unit_uuid,
        version_number=next_version,
        content=request.content,
        model_config=request.config,  # Map schema field 'config' to model field 'model_config'
        git_commit=request.git_commit,
        git_branch=request.git_branch,
        created_by=user_id,
        status="draft",
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return serialize_behavior_version(version)


@router.get("/{unit_id}/versions", response_model=List[BehaviorVersionResponse])
async def list_versions(
    unit_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get version history for a behavior unit."""
    unit_uuid = uuid.UUID(unit_id)
    org_id = uuid.UUID(current["org_id"])
    
    # Verify unit exists and belongs to org
    stmt = select(BehaviorUnit).where(
        (BehaviorUnit.id == unit_uuid) & (BehaviorUnit.org_id == org_id)
    )
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Unit not found")
    
    version_stmt = select(BehaviorVersion).where(
        BehaviorVersion.unit_id == unit_uuid
    ).order_by(desc(BehaviorVersion.version_number))
    version_result = await db.execute(version_stmt)
    versions = version_result.scalars().all()
    
    return [serialize_behavior_version(version) for version in versions]


@router.post("/{unit_id}/versions/{version_id}/deploy")
async def deploy_version(
    unit_id: str,
    version_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deploy a version (set to deployed, roll back others)."""
    unit_uuid = uuid.UUID(unit_id)
    version_uuid = uuid.UUID(version_id)
    org_id = uuid.UUID(current["org_id"])
    
    # Verify unit exists
    stmt = select(BehaviorUnit).where(
        (BehaviorUnit.id == unit_uuid) & (BehaviorUnit.org_id == org_id)
    )
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Set target version to deployed
    version_stmt = select(BehaviorVersion).where(
        (BehaviorVersion.id == version_uuid) & (BehaviorVersion.unit_id == unit_uuid)
    )
    version_result = await db.execute(version_stmt)
    version = version_result.scalars().first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    version.status = "deployed"
    
    # Roll back all others
    other_stmt = select(BehaviorVersion).where(
        (BehaviorVersion.unit_id == unit_uuid) & (BehaviorVersion.id != version_uuid)
    )
    other_result = await db.execute(other_stmt)
    others = other_result.scalars().all()
    for other in others:
        other.status = "rolled_back"
    
    await db.commit()
    return {"status": "deployed", "version_number": version.version_number}


@router.post("/{unit_id}/versions/{version_id}/rollback")
async def rollback_version(
    unit_id: str,
    version_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rollback to a previous version (set it as deployed)."""
    unit_uuid = uuid.UUID(unit_id)
    version_uuid = uuid.UUID(version_id)
    org_id = uuid.UUID(current["org_id"])
    
    # Verify unit exists
    stmt = select(BehaviorUnit).where(
        (BehaviorUnit.id == unit_uuid) & (BehaviorUnit.org_id == org_id)
    )
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Set target version to deployed
    version_stmt = select(BehaviorVersion).where(
        (BehaviorVersion.id == version_uuid) & (BehaviorVersion.unit_id == unit_uuid)
    )
    version_result = await db.execute(version_stmt)
    version = version_result.scalars().first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    version.status = "deployed"
    
    # Roll back all others
    other_stmt = select(BehaviorVersion).where(
        (BehaviorVersion.unit_id == unit_uuid) & (BehaviorVersion.id != version_uuid)
    )
    other_result = await db.execute(other_stmt)
    others = other_result.scalars().all()
    for other in others:
        other.status = "rolled_back"
    
    await db.commit()
    
    # Log audit event
    from app.models.models import AuditLog
    audit = AuditLog(
        id=uuid.uuid4(),
        org_id=org_id,
        action="version_rollback",
        actor_id=uuid.UUID(current["user_id"]),
        resource_type="BehaviorVersion",
        resource_id=str(version_uuid),
        metadata_={"unit_id": str(unit_uuid), "version_number": version.version_number},
    )
    db.add(audit)
    await db.commit()
    
    return {"status": "rolled_back", "version_number": version.version_number}


class VersionDiffResponse(BaseModel):
    """Version diff response."""
    v1_number: int
    v2_number: int
    v1_content: dict
    v2_content: dict
    semantic_diff: Optional[dict] = None


@router.get("/{unit_id}/diff/{v1_num}/{v2_num}", response_model=VersionDiffResponse)
async def get_version_diff(
    unit_id: str,
    v1_num: int,
    v2_num: int,
    eval_set_id: Optional[str] = None,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get diff between two versions for frontend comparison."""
    unit_uuid = uuid.UUID(unit_id)
    org_id = uuid.UUID(current["org_id"])
    
    # Verify unit exists and belongs to org
    stmt = select(BehaviorUnit).where(
        (BehaviorUnit.id == unit_uuid) & (BehaviorUnit.org_id == org_id)
    )
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Get v1
    v1_stmt = select(BehaviorVersion).where(
        (BehaviorVersion.unit_id == unit_uuid) & (BehaviorVersion.version_number == v1_num)
    )
    v1_result = await db.execute(v1_stmt)
    v1 = v1_result.scalars().first()
    if not v1:
        raise HTTPException(status_code=404, detail=f"Version {v1_num} not found")
    
    # Get v2
    v2_stmt = select(BehaviorVersion).where(
        (BehaviorVersion.unit_id == unit_uuid) & (BehaviorVersion.version_number == v2_num)
    )
    v2_result = await db.execute(v2_stmt)
    v2 = v2_result.scalars().first()
    if not v2:
        raise HTTPException(status_code=404, detail=f"Version {v2_num} not found")

    semantic_diff = None
    eval_cases = []

    eval_set_stmt = None
    if eval_set_id:
        eval_set_uuid = uuid.UUID(eval_set_id)
        eval_set_stmt = select(EvalSet).where(
            (EvalSet.id == eval_set_uuid)
            & (EvalSet.unit_id == unit_uuid)
            & (EvalSet.org_id == org_id)
        )
    else:
        eval_set_stmt = (
            select(EvalSet)
            .where((EvalSet.unit_id == unit_uuid) & (EvalSet.org_id == org_id))
            .order_by(desc(EvalSet.created_at))
        )

    eval_set_result = await db.execute(eval_set_stmt)
    eval_set = eval_set_result.scalars().first()

    if eval_set:
        eval_cases = eval_set.cases or []
        semantic_diff = await semantic_diff_agent.compare_versions(v1, v2, eval_cases)
        semantic_diff["eval_set_id"] = str(eval_set.id)
        semantic_diff["eval_set_name"] = eval_set.name
        semantic_diff["eval_cases_count"] = len(eval_cases)
    else:
        semantic_diff = {
            "embedding_distance": 0.0,
            "refusal_rate_delta": 0.0,
            "length_delta": 0.0,
            "judge_scores": {},
            "summary": "Create an eval set to generate a semantic diff",
            "samples_compared": 0,
            "eval_set_id": None,
            "eval_set_name": None,
            "eval_cases_count": 0,
        }
    
    return {
        "v1_number": v1_num,
        "v2_number": v2_num,
        "v1_content": v1.content,
        "v2_content": v2.content,
        "semantic_diff": semantic_diff,
    }
