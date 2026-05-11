"""GitHub integration endpoints for PromptLedger."""

from __future__ import annotations

import base64
import json
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.models import (
    BehaviorUnit,
    BehaviorVersion,
    EvalRun,
    EvalSet,
    GitHubIntegration,
    GitHubSyncEvent,
)
from app.schemas.schemas import (
    GitHubIntegrationCreateRequest,
    GitHubIntegrationResponse,
    GitHubSyncRequest,
    GitHubSyncResponse,
)
from app.workers.tasks import run_regression_eval


router = APIRouter(prefix="/github", tags=["github"])


def serialize_integration(integration: GitHubIntegration) -> dict:
    return {
        "id": str(integration.id),
        "org_id": str(integration.org_id),
        "unit_id": str(integration.unit_id) if integration.unit_id else None,
        "repo_full_name": integration.repo_full_name,
        "default_branch": integration.default_branch,
        "tracked_paths": integration.tracked_paths or [],
        "enabled": integration.enabled,
        "created_at": integration.created_at,
    }


def serialize_sync_event(event: GitHubSyncEvent) -> dict:
    return {
        "id": str(event.id),
        "org_id": str(event.org_id),
        "integration_id": str(event.integration_id),
        "unit_id": str(event.unit_id) if event.unit_id else None,
        "version_id": str(event.version_id) if event.version_id else None,
        "event_type": event.event_type,
        "branch": event.branch,
        "commit_sha": event.commit_sha,
        "file_path": event.file_path,
        "status": event.status,
        "details": event.details,
        "created_at": event.created_at,
    }


def _coerce_prompt_content(raw_text: str, file_path: str, metadata: dict | None = None) -> dict:
    parsed: dict | None = None
    stripped = raw_text.strip()
    if stripped:
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                candidate = json.loads(stripped)
                if isinstance(candidate, dict):
                    parsed = candidate
            except Exception:
                parsed = None

    if parsed is None:
        parsed = {
            "prompt": raw_text,
        }

    parsed.setdefault("source", {})
    parsed["source"].update({
        "file_path": file_path,
        "kind": "github_file",
    })
    if metadata:
        parsed["source"].update(metadata)
    return parsed


async def _fetch_github_file_content(
    repo_full_name: str,
    file_path: str,
    token: str,
    ref: Optional[str] = None,
) -> tuple[dict, str | None]:
    url = f"https://api.github.com/repos/{repo_full_name}/contents/{file_path.lstrip('/')}"
    params = {"ref": ref} if ref else None
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params, headers=headers)

    if response.status_code == 404:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GitHub file not found")
    if response.status_code in {401, 403}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub token rejected or lacks access")
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub API error: {response.text[:200]}")

    payload = response.json()
    if isinstance(payload, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitHub path points to a directory, not a file")

    content_text = ""
    encoding = payload.get("encoding")
    if payload.get("type") == "file" and payload.get("content"):
        if encoding == "base64":
            content_text = base64.b64decode(payload["content"].encode("utf-8")).decode("utf-8", errors="replace")
        else:
            content_text = payload["content"]
    elif payload.get("download_url"):
        async with httpx.AsyncClient(timeout=20.0) as client:
            raw_response = await client.get(payload["download_url"], headers=headers)
        if raw_response.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to download GitHub file content")
        content_text = raw_response.text
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported GitHub response for file content")

    metadata = {
        "github_path": payload.get("path", file_path),
        "github_sha": payload.get("sha"),
        "github_name": payload.get("name"),
        "github_size": payload.get("size"),
        "github_url": payload.get("html_url"),
        "github_ref": ref,
    }
    return _coerce_prompt_content(content_text, file_path, metadata), payload.get("sha")


async def _resolve_unit(
    db: AsyncSession,
    org_id: uuid.UUID,
    unit_name: str,
    unit_id: Optional[str] = None,
) -> BehaviorUnit:
    if unit_id:
        unit_uuid = uuid.UUID(unit_id)
        unit_stmt = select(BehaviorUnit).where(
            (BehaviorUnit.id == unit_uuid) & (BehaviorUnit.org_id == org_id)
        )
        unit_result = await db.execute(unit_stmt)
        unit = unit_result.scalars().first()
        if not unit:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Behavior unit not found")
        return unit

    unit_stmt = select(BehaviorUnit).where(
        (BehaviorUnit.org_id == org_id) & (BehaviorUnit.name == unit_name)
    )
    unit_result = await db.execute(unit_stmt)
    unit = unit_result.scalars().first()
    if unit:
        return unit

    unit = BehaviorUnit(
        id=uuid.uuid4(),
        org_id=org_id,
        name=unit_name,
        description="Auto-created from GitHub sync",
        unit_type="prompt",
    )
    db.add(unit)
    await db.flush()
    return unit


@router.post("/integrations", response_model=GitHubIntegrationResponse)
async def create_integration(
    request: GitHubIntegrationCreateRequest,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = uuid.UUID(current["org_id"])
    unit = None
    if request.unit_id:
        unit_uuid = uuid.UUID(request.unit_id)
        unit_stmt = select(BehaviorUnit).where(
            (BehaviorUnit.id == unit_uuid) & (BehaviorUnit.org_id == org_id)
        )
        unit_result = await db.execute(unit_stmt)
        unit = unit_result.scalars().first()
        if not unit:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Behavior unit not found")

    existing_stmt = select(GitHubIntegration).where(
        (GitHubIntegration.org_id == org_id) & (GitHubIntegration.repo_full_name == request.repo_full_name)
    )
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalars().first()
    if existing:
        existing.default_branch = request.default_branch
        existing.unit_id = unit.id if unit else existing.unit_id
        existing.tracked_paths = request.tracked_paths
        existing.enabled = request.enabled
        await db.commit()
        await db.refresh(existing)
        return serialize_integration(existing)

    integration = GitHubIntegration(
        id=uuid.uuid4(),
        org_id=org_id,
        unit_id=unit.id if unit else None,
        repo_full_name=request.repo_full_name,
        default_branch=request.default_branch,
        tracked_paths=request.tracked_paths,
        enabled=request.enabled,
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return serialize_integration(integration)


@router.get("/integrations", response_model=list[GitHubIntegrationResponse])
async def list_integrations(
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = uuid.UUID(current["org_id"])
    stmt = select(GitHubIntegration).where(GitHubIntegration.org_id == org_id).order_by(desc(GitHubIntegration.created_at))
    result = await db.execute(stmt)
    return [serialize_integration(integration) for integration in result.scalars().all()]


@router.post("/integrations/{integration_id}/sync", response_model=GitHubSyncResponse)
async def sync_prompt_from_github(
    integration_id: str,
    request: GitHubSyncRequest,
    current: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = uuid.UUID(current["org_id"])
    integration_uuid = uuid.UUID(integration_id)

    integration_stmt = select(GitHubIntegration).where(
        (GitHubIntegration.id == integration_uuid) & (GitHubIntegration.org_id == org_id)
    )
    integration_result = await db.execute(integration_stmt)
    integration = integration_result.scalars().first()
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GitHub integration not found")

    unit = await _resolve_unit(db, org_id, request.unit_name, unit_id=str(integration.unit_id) if integration.unit_id else None)

    version_stmt = select(BehaviorVersion).where(BehaviorVersion.unit_id == unit.id).order_by(desc(BehaviorVersion.version_number)).limit(1)
    version_result = await db.execute(version_stmt)
    latest_version = version_result.scalars().first()
    next_version = (latest_version.version_number if latest_version else 0) + 1

    content = request.content if isinstance(request.content, dict) else {}

    fetched_sha = None
    if request.github_token and (not content or content == {}):
        repo_full_name = request.repo_full_name or integration.repo_full_name
        content, fetched_sha = await _fetch_github_file_content(
            repo_full_name=repo_full_name,
            file_path=request.file_path,
            token=request.github_token,
            ref=request.github_ref or request.branch or integration.default_branch,
        )

    if (not content or content == {}) and not request.github_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide prompt content or a GitHub token for remote file fetch",
        )

    model_config = request.model_config or content.get("model_config") or {}

    version = BehaviorVersion(
        id=uuid.uuid4(),
        unit_id=unit.id,
        version_number=next_version,
        content=content,
        model_config=model_config,
        git_commit=request.commit_sha,
        git_branch=request.branch or integration.default_branch,
        source_provider="github",
        source_repo=integration.repo_full_name,
        source_path=request.file_path,
        source_ref=f"{integration.repo_full_name}@{request.github_ref or request.branch or integration.default_branch}",
        source_sha=request.commit_sha or fetched_sha,
        created_by=None,
        status="draft",
    )
    db.add(version)
    await db.flush()

    eval_run = None
    chosen_eval_set = None
    if request.trigger_eval:
        if request.eval_set_id:
            eval_set_uuid = uuid.UUID(request.eval_set_id)
            eval_stmt = select(EvalSet).where((EvalSet.id == eval_set_uuid) & (EvalSet.org_id == org_id))
            eval_result = await db.execute(eval_stmt)
            chosen_eval_set = eval_result.scalars().first()
        else:
            eval_stmt = select(EvalSet).where((EvalSet.unit_id == unit.id) & (EvalSet.org_id == org_id)).order_by(desc(EvalSet.created_at)).limit(1)
            eval_result = await db.execute(eval_stmt)
            chosen_eval_set = eval_result.scalars().first()

        if chosen_eval_set:
            eval_run = EvalRun(
                id=uuid.uuid4(),
                version_id=version.id,
                eval_set_id=chosen_eval_set.id,
                status="pending",
                triggered_by="github-sync",
            )
            db.add(eval_run)

    sync_event = GitHubSyncEvent(
        id=uuid.uuid4(),
        org_id=org_id,
        integration_id=integration.id,
        unit_id=unit.id,
        version_id=version.id,
        event_type="sync",
        branch=request.branch or integration.default_branch,
        commit_sha=request.commit_sha,
        file_path=request.file_path,
        status="queued" if eval_run else "synced",
        details={
            "unit_name": request.unit_name,
            "repo_full_name": request.repo_full_name or integration.repo_full_name,
            "file_path": request.file_path,
            "trigger_eval": request.trigger_eval,
            "eval_set_id": str(chosen_eval_set.id) if chosen_eval_set else None,
        },
    )
    db.add(sync_event)
    await db.commit()

    if eval_run:
        run_regression_eval.delay(str(eval_run.id))

    return {
        "integration_id": str(integration.id),
        "unit_id": str(unit.id),
        "version_id": str(version.id),
        "eval_run_id": str(eval_run.id) if eval_run else None,
        "status": "queued_eval" if eval_run else "synced",
        "message": "Prompt version synced from GitHub content",
    }
