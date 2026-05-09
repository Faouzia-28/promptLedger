# Environment and Local Services

This file documents the environment variables and how to enable optional services used by the backend during local development.

## Redis (optional)

- Purpose: used by the Redis-backed rate limiter and other cache/queue features.
- Default env var: `REDIS_URL` (e.g. `redis://127.0.0.1:6379/0`).
- The app already reads `REDIS_URL` from `backend/.env` or the environment.
- Redis-backed rate limiting is opt-in. Set both `REDIS_URL` and `ENABLE_REDIS_RATE_LIMITING=true` to enable it later, then restart the backend.

Start Redis locally with Docker (if you have Docker):

```powershell
docker run -d --name promptledger-redis -p 6379:6379 redis:7
```

Or run Redis elsewhere and point `REDIS_URL` to it, for example:

```
REDIS_URL=redis://redis-host:6379/0
ENABLE_REDIS_RATE_LIMITING=true
```

If `ENABLE_REDIS_RATE_LIMITING` is false or `REDIS_URL` is not set, the app falls back to the in-process rate limiter and will continue to function. After enabling both variables, restart the server and confirm the `RedisRateLimitMiddleware` is active by checking logs on startup and any keys in Redis.

## Prometheus metrics

- The app exposes a `/metrics` endpoint when `prometheus_client` is installed.
- Install in the backend venv:

```powershell
Set-Location -Path backend
.\venv\Scripts\python.exe -m pip install prometheus_client
```

If `prometheus_client` is not installed the `/metrics` endpoint will return 501 and instrumentation is a no-op.

## Where env vars live

- Local development: `backend/.env` contains defaults. Do not commit production secrets.
- For production, set env vars via your deployment system (Azure/Heroku/GCP/etc.).
