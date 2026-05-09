"""Alert configuration endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List
from app.core.database import get_db
from app.api.auth import get_current_user, require_roles
from app.models.models import AlertConfig
import uuid
from datetime import datetime


router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertConfigCreateRequest(BaseModel):
    """Create alert config request."""
    alert_type: str  # drift, regression, compliance, performance
    channel: str  # email, slack, webhook
    config: dict  # channel-specific config
    enabled: bool = True


class AlertConfigResponse(BaseModel):
    """Alert config response."""
    id: str
    org_id: str
    alert_type: str
    channel: str
    config: dict
    enabled: bool
    created_at: datetime


def serialize_alert_config(config: AlertConfig) -> dict:
    return {
        "id": str(config.id),
        "org_id": str(config.org_id),
        "alert_type": config.alert_type,
        "channel": config.channel,
        "config": config.config,
        "enabled": config.enabled,
        "created_at": config.created_at,
    }


@router.post("", response_model=AlertConfigResponse)
async def create_alert_config(
    request: AlertConfigCreateRequest,
    current: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new alert configuration."""
    org_id = uuid.UUID(current["org_id"])
    
    alert_config = AlertConfig(
        id=uuid.uuid4(),
        org_id=org_id,
        alert_type=request.alert_type,
        channel=request.channel,
        config=request.config,
        enabled=request.enabled,
    )
    db.add(alert_config)
    await db.commit()
    await db.refresh(alert_config)
    return serialize_alert_config(alert_config)


@router.get("", response_model=List[AlertConfigResponse])
async def list_alert_configs(
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all alert configurations for org."""
    org_id = uuid.UUID(current["org_id"])
    
    stmt = select(AlertConfig).where(AlertConfig.org_id == org_id)
    result = await db.execute(stmt)
    return [serialize_alert_config(item) for item in result.scalars().all()]


@router.get("/{config_id}", response_model=AlertConfigResponse)
async def get_alert_config(
    config_id: str,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific alert configuration."""
    config_uuid = uuid.UUID(config_id)
    org_id = uuid.UUID(current["org_id"])
    
    stmt = select(AlertConfig).where(
        (AlertConfig.id == config_uuid) & (AlertConfig.org_id == org_id)
    )
    result = await db.execute(stmt)
    config = result.scalars().first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Alert config not found")
    
    return serialize_alert_config(config)


@router.put("/{config_id}", response_model=AlertConfigResponse)
async def update_alert_config(
    config_id: str,
    request: AlertConfigCreateRequest,
    current: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update an alert configuration."""
    config_uuid = uuid.UUID(config_id)
    org_id = uuid.UUID(current["org_id"])
    
    stmt = select(AlertConfig).where(
        (AlertConfig.id == config_uuid) & (AlertConfig.org_id == org_id)
    )
    result = await db.execute(stmt)
    config = result.scalars().first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Alert config not found")
    
    config.alert_type = request.alert_type
    config.channel = request.channel
    config.config = request.config
    config.enabled = request.enabled
    
    await db.commit()
    await db.refresh(config)
    return serialize_alert_config(config)


@router.delete("/{config_id}")
async def delete_alert_config(
    config_id: str,
    current: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete an alert configuration."""
    config_uuid = uuid.UUID(config_id)
    org_id = uuid.UUID(current["org_id"])
    
    stmt = select(AlertConfig).where(
        (AlertConfig.id == config_uuid) & (AlertConfig.org_id == org_id)
    )
    result = await db.execute(stmt)
    config = result.scalars().first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Alert config not found")
    
    await db.delete(config)
    await db.commit()
    
    return {"status": "deleted"}
