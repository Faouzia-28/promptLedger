"""Webhook handlers for GitHub and SDK."""
import hmac
import json
from fastapi import APIRouter, Request, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.agents.drift_agent import drift_agent
from app.api.github import _process_github_webhook_payload
from app.workers.tasks import investigate_drift
from app.core.database import get_db
from app.core.idempotency import build_idempotency_key, claim_idempotency_key
from app.schemas.schemas import GitHubWebhookPayload, SDKWebhookPayload, ProductionSampleRequest


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/github")
async def github_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Process GitHub push webhook.
    Verifies HMAC signature and queues processing.
    """
    body = await request.body()
    payload = GitHubWebhookPayload.model_validate_json(body)
    
    # Verify HMAC signature
    signature = request.headers.get('X-Hub-Signature-256', '')
    if not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature")
    
    expected_sig = 'sha256=' + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        body,
        'sha256'
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected_sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    
    delivery_id = request.headers.get("X-GitHub-Delivery", "")
    idempotency_key = build_idempotency_key(
        "github.webhook",
        explicit_key=delivery_id or None,
        payload=payload.model_dump(mode="json"),
    )
    claimed = await claim_idempotency_key(idempotency_key)
    if claimed.is_duplicate:
        return {"status": "duplicate", "event": payload.action or "push"}

    result = await _process_github_webhook_payload(db, payload.model_dump(mode="json"))

    return {"status": result.get("status", "processed"), "event": payload.action or "push", "result": result}


@router.post("/sdk/{webhook_token}")
async def sdk_webhook(webhook_token: str, request: Request):
    """
    Process SDK webhook. Token acts as authentication.
    Payload: {unit_name, input, output, model, temperature, max_tokens}
    """
    payload = SDKWebhookPayload.model_validate(await request.json())
    
    # Validate token (in production, lookup token in DB)
    # For now, just accept any token
    if not webhook_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    # Extract org_id from token (stub - in production, lookup in DB)
    org_id = payload.org_id
    
    # Process SDK call (stub for now)
    unit_name = payload.unit_name

    idempotency_key = build_idempotency_key(
        "sdk.webhook",
        explicit_key=payload.idempotency_key,
        payload=payload.model_dump(mode="json"),
    )
    claimed = await claim_idempotency_key(idempotency_key)
    if claimed.is_duplicate:
        return {"status": "duplicate", "unit_name": unit_name, "message": "SDK call already processed"}
    
    return {
        'status': 'received',
        'unit_name': unit_name,
        'message': 'SDK call received and queued for processing'
    }


@router.post("/ingest/output")
async def ingest_production_output(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Ingest production output sample.
    Payload: {unit_id, input, output, model}
    Stores as ProductionSample, queues drift check.
    """
    payload = ProductionSampleRequest.model_validate(await request.json())
    idempotency_key = build_idempotency_key(
        "webhooks.ingest.output",
        explicit_key=payload.idempotency_key,
        payload=payload.model_dump(mode="json"),
    )
    claimed = await claim_idempotency_key(idempotency_key)
    if claimed.is_duplicate:
        return {'status': 'duplicate', 'unit_id': payload.unit_id, 'message': 'Production sample already ingested'}
    
    # Store production sample
    try:
        await drift_agent.store_production_sample(db, payload.unit_id, payload.input_text, payload.output_text)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                          detail=f"Failed to store sample: {str(e)}")
    
    return {
        'status': 'ingested',
        'unit_id': payload.unit_id,
        'message': 'Production sample received and will be checked for drift'
    }

