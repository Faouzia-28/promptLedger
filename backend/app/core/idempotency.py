"""Helpers for request idempotency and duplicate ingress protection."""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any, Optional

from app.core.redis_limiter import create_redis_client


@dataclass
class IdempotencyResult:
	is_duplicate: bool
	key: str


_LOCAL_WINDOW_SECONDS = 24 * 60 * 60
_LOCAL_CACHE: dict[str, float] = {}


def _normalize_payload(payload: Any) -> str:
	return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def build_idempotency_key(namespace: str, *, explicit_key: Optional[str] = None, payload: Any = None) -> str:
	"""Create a stable idempotency key from an explicit key or a payload digest."""
	if explicit_key:
		material = explicit_key.strip()
	else:
		material = _normalize_payload(payload)
	digest = hashlib.sha256(material.encode("utf-8")).hexdigest()
	return f"idem:{namespace}:{digest}"


async def claim_idempotency_key(key: str, ttl_seconds: int = _LOCAL_WINDOW_SECONDS) -> IdempotencyResult:
	"""Claim a key using Redis when available, otherwise a local TTL cache."""
	client = create_redis_client()
	if client is not None:
		try:
			claimed = await client.set(key, "1", ex=ttl_seconds, nx=True)
			return IdempotencyResult(is_duplicate=not bool(claimed), key=key)
		except Exception:
			pass

	now = time.time()
	cutoff = now - ttl_seconds
	for cached_key, timestamp in list(_LOCAL_CACHE.items()):
		if timestamp < cutoff:
			_LOCAL_CACHE.pop(cached_key, None)

	if key in _LOCAL_CACHE:
		return IdempotencyResult(is_duplicate=True, key=key)

	_LOCAL_CACHE[key] = now
	return IdempotencyResult(is_duplicate=False, key=key)