"""Helper to create a Redis client for rate limiting."""
from typing import Optional
import os

REDIS_URL = os.getenv("REDIS_URL", "")
ENABLE_REDIS_RATE_LIMITING = os.getenv("ENABLE_REDIS_RATE_LIMITING", "false").lower() in {"1", "true", "yes", "on"}


def create_redis_client():
    if not ENABLE_REDIS_RATE_LIMITING or not REDIS_URL:
        return None

    try:
        from redis.asyncio import Redis
        return Redis.from_url(REDIS_URL)
    except Exception:
        return None
