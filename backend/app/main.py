"""PromptLedger FastAPI application.

Main entry point for the backend API.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.logging import configure_logging
from app.core.middleware import RateLimitMiddleware, RequestSizeLimiterMiddleware
from starlette.responses import Response
import logging
from app.core.config import settings
from app.api import auth, units, evals, drift, compliance, alerts, webhooks
from contextlib import asynccontextmanager


configure_logging()
logger = logging.getLogger(__name__)

# Store active WebSocket connections by org_id
org_connections: dict[str, list[WebSocket]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info(f"Starting PromptLedger API - LLM Provider: {settings.LLM_PROVIDER}")
    if settings.LLM_PROVIDER == "ollama":
        logger.info(f"  Ollama URL: {settings.OLLAMA_BASE_URL}")
        logger.info(f"  Models: {settings.OLLAMA_MODEL} (standard), {settings.OLLAMA_FAST_MODEL} (fast)")
    else:
        logger.info(f"  Groq API: {settings.GROQ_MODEL}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down PromptLedger API")


# Create FastAPI app
app = FastAPI(
    title="PromptLedger API",
    version="1.0.0",
    description="Local-first LLM evaluation and monitoring platform",
    lifespan=lifespan,
)

# Attach middleware: request size limiter and simple in-memory rate limiter
app.add_middleware(RequestSizeLimiterMiddleware, max_body_size=1024 * 1024)

# Prefer Redis-backed rate limiter when Redis is reachable, else fall back to in-memory
from app.core.redis_limiter import create_redis_client
redis_client = create_redis_client()
if redis_client:
    try:
        # register Redis-based limiter as lower-priority middleware by adding directly
        from app.core.middleware import RedisRateLimitMiddleware
        app.add_middleware(RedisRateLimitMiddleware, redis=redis_client, max_requests=120, window_seconds=60)
    except Exception:
        pass
else:
    app.add_middleware(RateLimitMiddleware, max_requests=120, window_seconds=60)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        settings.FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
async def health_check():
    """API health check."""
    logger.info("health_check", extra={"event": "health_check", "status": "ok"})
    return {
        "status": "ok",
        "llm_provider": settings.LLM_PROVIDER,
        "version": "1.0.0",
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    try:
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    except Exception:
        return Response(status_code=501, content="prometheus_client not installed")
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)


# WebSocket for drift event notifications
@app.websocket("/ws/drift/{org_id}")
async def websocket_drift_endpoint(org_id: str, websocket: WebSocket):
    """WebSocket endpoint for org-specific drift event notifications."""
    await websocket.accept()
    
    # Store connection
    if org_id not in org_connections:
        org_connections[org_id] = []
    org_connections[org_id].append(websocket)
    
    logger.info(f"WebSocket connected for org {org_id}")
    
    try:
        while True:
            # Keep connection alive by waiting for messages
            data = await websocket.receive_text()
            # Echo ping/pong for keep-alive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for org {org_id}")
        org_connections[org_id].remove(websocket)
        if not org_connections[org_id]:
            del org_connections[org_id]
    except Exception as e:
        logger.error(f"WebSocket error for org {org_id}: {e}")


async def broadcast_drift_event(org_id: str, event: dict):
    """Broadcast a drift event to all connected clients for an org."""
    if org_id in org_connections:
        disconnected = []
        for connection in org_connections[org_id]:
            try:
                await connection.send_json(event)
            except Exception as e:
                logger.error(f"Failed to send event: {e}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for conn in disconnected:
            org_connections[org_id].remove(conn)


# Include routers under /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(units.router, prefix="/api/v1")
app.include_router(evals.router, prefix="/api/v1")
app.include_router(drift.router, prefix="/api/v1")
app.include_router(compliance.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")

# Include webhooks (no /api/v1 prefix for webhooks)
app.include_router(webhooks.router)
