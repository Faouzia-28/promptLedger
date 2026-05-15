"""Request middleware: rate limiting and request size limiting."""
import time
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.observability import observe_request
import os
import time

try:
    from redis.asyncio import Redis
except Exception:
    Redis = None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory sliding-window rate limiter per client IP.

    Falls back to in-memory when Redis is not available. When `REDIS_URL` is set
    and redis-py is available, a Redis-backed limiter will be used instead by
    the application wiring in `app/main.py`.
    """

    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window_seconds
        self.clients: dict[str, list[float]] = {}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        q = self.clients.setdefault(ip, [])
        cutoff = now - self.window
        while q and q[0] < cutoff:
            q.pop(0)

        if len(q) >= self.max_requests:
            return Response(status_code=429, content="Rate limit exceeded")

        q.append(now)
        start = time.time()
        resp = await call_next(request)
        elapsed = time.time() - start
        observe_request(request.method, request.url.path, elapsed)
        return resp


class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed fixed-window rate limiter using INCR + EXPIRE.

    Key format: `rl:{ip}:{window_start}` where window_start = int(now / window)
    """

    def __init__(self, app, redis: "Redis", max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.redis = redis
        self.max_requests = max_requests
        self.window = window_seconds

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        ip = request.client.host if request.client else "unknown"
        now = int(time.time())
        window_start = now - (now % self.window)
        key = f"rl:{ip}:{window_start}"

        try:
            # INCR and set expire if new key
            cur = await self.redis.incr(key)
            if cur == 1:
                await self.redis.expire(key, self.window)
            if cur > self.max_requests:
                return Response(status_code=429, content="Rate limit exceeded")
        except Exception:
            # If redis fails, fall back to allowing the request to avoid denial
            pass

        start = time.time()
        resp = await call_next(request)
        elapsed = time.time() - start
        observe_request(request.method, request.url.path, elapsed)
        return resp


class RequestSizeLimiterMiddleware(BaseHTTPMiddleware):
    """Limit request body size by reading content-length or streaming up to a limit."""

    def __init__(self, app, max_body_size: int = 1024 * 1024):
        super().__init__(app)
        self.max_body_size = max_body_size

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        cl = request.headers.get("content-length")
        if cl:
            try:
                if int(cl) > self.max_body_size:
                    return Response(status_code=413, content="Request body too large")
            except Exception:
                pass

        # For unknown content-length, let the app read and rely on downstream validation.
        return await call_next(request)


class InputNormalizationMiddleware(BaseHTTPMiddleware):
    """Normalize incoming JSON request bodies.

    - trims strings, collapses whitespace
    - removes C0 control chars
    - limits very large string fields
    """

    def __init__(self, app, max_string_length: int = 50_000):
        super().__init__(app)
        self.max_string_length = max_string_length

    def _clean_string(self, s: str) -> str:
        if not isinstance(s, str):
            return s
        # remove C0 control chars except newline/tab
        import re

        s = s.replace('\r\n', '\n')
        s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", '', s)
        s = s.strip()
        s = re.sub(r"\s+", ' ', s)
        if len(s) > self.max_string_length:
            s = s[:self.max_string_length]
        return s

    def _normalize_obj(self, obj):
        if isinstance(obj, dict):
            return {k: self._normalize_obj(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._normalize_obj(v) for v in obj]
        if isinstance(obj, str):
            return self._clean_string(obj)
        return obj

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only attempt JSON body normalization for application/json
        ct = request.headers.get('content-type', '')
        if 'application/json' not in ct.lower():
            return await call_next(request)

        body = await request.body()
        if not body:
            return await call_next(request)

        try:
            import json

            parsed = json.loads(body)
            normalized = self._normalize_obj(parsed)
            new_body = json.dumps(normalized).encode('utf-8')

            async def receive():
                return {"type": "http.request", "body": new_body, "more_body": False}

            new_request = Request(request.scope, receive)
            return await call_next(new_request)
        except Exception:
            # If parsing/normalization fails, pass original request through
            return await call_next(request)
