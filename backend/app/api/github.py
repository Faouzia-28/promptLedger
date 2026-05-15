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
        "has_github_token": bool(getattr(integration, "github_access_token", None)),
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
    # If parsed is a dict, try to map common keys to canonical structure
    def _sanitize_text(s: str) -> str:
        import re
        s = s or ''
        s = s.replace('\r\n', '\n')
        s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", '', s)
        s = s.strip()
        s = re.sub(r"\s+", ' ', s)
        # Strip simple markdown/code fences
        s = re.sub(r"^```[\s\S]*?```$", lambda m: m.group(0).strip('`'), s)
        # Remove HTML tags conservatively
        s = re.sub(r"<[^>]+>", '', s)
        return s

    if parsed is None:
        parsed = {
            "prompt": raw_text,
        }
    else:
        # Map flexible placeholder keys to `prompt`
        mapping_keys = [
            'prompt', 'text', 'input', 'instruction', 'query', 'message', 'content', 'user_prompt', 'system_prompt'
        ]
        # If parsed contains a top-level key with content, map it
        for key in mapping_keys:
            if key in parsed and isinstance(parsed.get(key), str) and parsed.get(key).strip():
                parsed = {'prompt': parsed.get(key), **{k: v for k, v in parsed.items() if k not in mapping_keys}}
                break

    # Sanitize prompt text fields
    if isinstance(parsed.get('prompt'), str):
        parsed['prompt'] = _sanitize_text(parsed['prompt'])

    parsed.setdefault("source", {})
    parsed["source"].update({
        "file_path": file_path,
        "kind": "github_file",
    })
    if metadata:
        parsed["source"].update(metadata)
    return parsed


def _github_api_headers(token: Optional[str]) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _fetch_github_file_content(
    repo_full_name: str,
    file_path: str,
    token: str,
    ref: Optional[str] = None,
) -> tuple[dict, str | None]:
    url = f"https://api.github.com/repos/{repo_full_name}/contents/{file_path.lstrip('/')}"
    params = {"ref": ref} if ref else None
    headers = _github_api_headers(token)

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


def _tracked_path_matches(file_path: str, tracked_paths: list[str]) -> bool:
    if not tracked_paths:
        return True
    normalized = file_path.lstrip("/")
    for tracked in tracked_paths:
        tracked_norm = tracked.lstrip("/")
        if normalized == tracked_norm:
            return True
        if tracked_norm.endswith("/") and normalized.startswith(tracked_norm):
            return True
        if normalized.startswith(f"{tracked_norm.rstrip('/')}/"):
            return True
    return False


def _normalize_ref_name(ref: Optional[str]) -> Optional[str]:
    if not ref:
        return None
    if ref.startswith("refs/heads/"):
        return ref.removeprefix("refs/heads/")
    if ref.startswith("refs/tags/"):
        return ref.removeprefix("refs/tags/")
    return ref


async def _github_compare_files(
    repo_full_name: str,
    base_sha: Optional[str],
    head_sha: Optional[str],
    token: Optional[str],
) -> list[str]:
    if not base_sha or not head_sha or not token:
        return []

    url = f"https://api.github.com/repos/{repo_full_name}/compare/{base_sha}...{head_sha}"
    headers = _github_api_headers(token)
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)

    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub compare failed: {response.text[:200]}")

    data = response.json()
    files = data.get("files", []) if isinstance(data, dict) else []
    changed: list[str] = []
    for item in files:
        filename = item.get("filename")
        if not filename:
            continue
        if item.get("status") == "removed":
            continue
        changed.append(filename)
    return changed


def _payload_event_type(payload: dict) -> str:
    if payload.get("pull_request"):
        return f"pull_request:{payload.get('action') or 'unknown'}"
    return payload.get("action") or "push"


async def _process_github_webhook_payload(db: AsyncSession, payload: dict) -> dict:
    repository = payload.get("repository") or {}
    repo_full_name = repository.get("full_name")
    if not repo_full_name:
        return {"status": "ignored", "message": "repository missing"}

    integrations_stmt = select(GitHubIntegration).where(
        (GitHubIntegration.repo_full_name == repo_full_name) & (GitHubIntegration.enabled.is_(True))
    )
    integrations_result = await db.execute(integrations_stmt)
    integrations = integrations_result.scalars().all()
    if not integrations:
        return {"status": "ignored", "message": "no matching integration"}

    changed_files: list[str] = []
    commit_sha: Optional[str] = payload.get("after")
    branch = _normalize_ref_name(payload.get("ref"))

    pull_request = payload.get("pull_request")
    base_sha = None
    head_sha = None
    if pull_request:
        base_sha = (pull_request.get("base") or {}).get("sha")
        head_sha = (pull_request.get("head") or {}).get("sha")
        commit_sha = head_sha or commit_sha
        branch = (pull_request.get("head") or {}).get("ref") or branch
    else:
        before = payload.get("before")
        after = payload.get("after")
        if before and after and not set(before) == {"0"}:
            base_sha = before
            head_sha = after

    for integration in integrations:
        # Decrypt token if stored encrypted
        token = getattr(integration, "github_access_token", None)
        if token:
            try:
                from app.core.security import decrypt_token
                token = decrypt_token(token)
            except Exception:
                # leave token as-is if decryption fails
                pass
        if base_sha and head_sha and token:
            changed_files = await _github_compare_files(repo_full_name, base_sha, head_sha, token)
        else:
            changed_files = []
            for commit in payload.get("commits", []) or []:
                for key in ("added", "modified", "removed"):
                    for file_path in commit.get(key, []) or []:
                        if file_path not in changed_files:
                            changed_files.append(file_path)

        relevant_files = [
            file_path for file_path in changed_files if _tracked_path_matches(file_path, integration.tracked_paths or [])
        ]

        if not relevant_files:
            if token and commit_sha:
                await _post_commit_status(repo_full_name, commit_sha, token, "success", "No tracked prompt files changed")
            continue

        sync_results = []
        status_state = "success"
        status_description = f"Processed {len(relevant_files)} tracked prompt file(s)"

        unit_name_fallback = repo_full_name.split("/")[-1]
        for file_path in relevant_files:
            try:
                content, fetched_sha = await _fetch_github_file_content(
                    repo_full_name=repo_full_name,
                    file_path=file_path,
                    token=token or "",
                    ref=head_sha or commit_sha or branch or integration.default_branch,
                )
                created = await _create_version_and_eval(
                    db,
                    integration=integration,
                    unit_name=unit_name_fallback,
                    file_path=file_path,
                    content=content,
                    model_config=content.get("model_config") if isinstance(content, dict) else None,
                    branch=branch or integration.default_branch,
                    commit_sha=commit_sha or fetched_sha,
                    github_ref=head_sha or branch or integration.default_branch,
                    trigger_eval=True,
                    eval_set_id=None,
                    source_provider="github-webhook",
                    event_type=_payload_event_type(payload),
                )
                sync_results.append({
                    "file_path": file_path,
                    "version_id": created["version_id"],
                    "eval_run_id": created["eval_run_id"],
                    "status": created["status"],
                })
            except Exception as exc:
                status_state = "failure"
                status_description = f"GitHub sync failed for {file_path}: {str(exc)[:80]}"
                sync_results.append({
                    "file_path": file_path,
                    "error": str(exc),
                    "status": "failed",
                })
                if token and commit_sha:
                    await _post_commit_status(repo_full_name, commit_sha, token, "failure", status_description)
                break

        if status_state == "success" and token and commit_sha:
            await _post_commit_status(repo_full_name, commit_sha, token, "success", status_description)

        return {
            "status": status_state,
            "repo_full_name": repo_full_name,
            "integration_ids": [str(integration.id) for integration in integrations],
            "files": sync_results,
        }

    return {"status": "ignored", "message": "no tracked files matched"}


async def _post_commit_status(
    repo_full_name: str,
    sha: Optional[str],
    token: Optional[str],
    state: str,
    description: str,
    *,
    context: str = "promptledger/eval",
) -> None:
    if not sha or not token:
        return

    url = f"https://api.github.com/repos/{repo_full_name}/statuses/{sha}"
    payload = {
        "state": state,
        "description": description[:140],
        "context": context,
    }
    headers = _github_api_headers(token)

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=payload, headers=headers)

    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub status update failed: {response.text[:200]}")


async def _create_version_and_eval(
    db: AsyncSession,
    *,
    integration: GitHubIntegration,
    unit_name: str,
    file_path: str,
    content: dict,
    model_config: Optional[dict] = None,
    branch: Optional[str],
    commit_sha: Optional[str],
    github_ref: Optional[str],
    trigger_eval: bool,
    eval_set_id: Optional[str],
    source_provider: str = "github",
    event_type: str = "sync",
) -> dict:
    org_id = integration.org_id
    unit = await _resolve_unit(
        db,
        org_id,
        unit_name,
        unit_id=str(integration.unit_id) if integration.unit_id else None,
    )

    version_stmt = select(BehaviorVersion).where(BehaviorVersion.unit_id == unit.id).order_by(desc(BehaviorVersion.version_number)).limit(1)
    version_result = await db.execute(version_stmt)
    latest_version = version_result.scalars().first()
    next_version = (latest_version.version_number if latest_version else 0) + 1

    model_config_value = model_config if model_config is not None else (content.get("model_config") or {})

    version = BehaviorVersion(
        id=uuid.uuid4(),
        unit_id=unit.id,
        version_number=next_version,
        content=content,
        model_config=model_config_value,
        git_commit=commit_sha,
        git_branch=branch or integration.default_branch,
        source_provider=source_provider,
        source_repo=integration.repo_full_name,
        source_path=file_path,
        source_ref=f"{integration.repo_full_name}@{github_ref or branch or integration.default_branch}",
        source_sha=commit_sha,
        created_by=None,
        status="draft",
    )
    db.add(version)
    await db.flush()

    eval_run = None
    chosen_eval_set = None
    if trigger_eval:
        if eval_set_id:
            eval_set_uuid = uuid.UUID(eval_set_id)
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
                triggered_by=event_type,
            )
            db.add(eval_run)

    sync_event = GitHubSyncEvent(
        id=uuid.uuid4(),
        org_id=org_id,
        integration_id=integration.id,
        unit_id=unit.id,
        version_id=version.id,
        event_type=event_type,
        branch=branch or integration.default_branch,
        commit_sha=commit_sha,
        file_path=file_path,
        status="queued" if eval_run else "synced",
        details={
            "unit_name": unit_name,
            "repo_full_name": integration.repo_full_name,
            "file_path": file_path,
            "trigger_eval": trigger_eval,
            "eval_set_id": str(chosen_eval_set.id) if chosen_eval_set else None,
            "source_provider": source_provider,
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
        "version": version,
        "eval_run": eval_run,
        "unit": unit,
    }


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
        if request.github_access_token:
            # Encrypt token before storing
            from app.core.security import encrypt_token
            existing.github_access_token = encrypt_token(request.github_access_token)
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
        github_access_token=(__import__('app.core.security', fromlist=['encrypt_token']).encrypt_token(request.github_access_token) if request.github_access_token else None),
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

    content = request.content if isinstance(request.content, dict) else {}

    fetched_sha = None
    token = request.github_token or integration.github_access_token
    if token and (not content or content == {}):
        repo_full_name = request.repo_full_name or integration.repo_full_name
        content, fetched_sha = await _fetch_github_file_content(
            repo_full_name=repo_full_name,
            file_path=request.file_path,
            token=token,
            ref=request.github_ref or request.branch or integration.default_branch,
        )

    if (not content or content == {}) and not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide prompt content or a GitHub token for remote file fetch",
        )

    created = await _create_version_and_eval(
        db,
        integration=integration,
        unit_name=request.unit_name,
        file_path=request.file_path,
        content=content,
        model_config=request.config,
        branch=request.branch or integration.default_branch,
        commit_sha=request.commit_sha or fetched_sha,
        github_ref=request.github_ref,
        trigger_eval=request.trigger_eval,
        eval_set_id=request.eval_set_id,
        source_provider="github",
        event_type="sync",
    )

    return {
        "integration_id": str(integration.id),
        "unit_id": str(unit.id),
        "version_id": created["version_id"],
        "eval_run_id": created["eval_run_id"],
        "status": created["status"],
        "message": "Prompt version synced from GitHub content",
    }
