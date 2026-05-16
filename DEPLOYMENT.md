# PromptLedger Deployment Guide

## Canonical Deployment Source

**The root repository at `D:\Desktop\promptledger` is the ONLY source of truth for production deployments.**

All code changes, configurations, and deployments must originate from the root repo. The nested folder at `aws/terraform/promptledger_test` is a separate git repository and is NOT part of the production deployment pipeline.

## Deployment Architecture

### Services Deployed
- **API** (`backend/app/main.py`): FastAPI backend on port 8000
- **Celery Worker**: Background task processor for eval runs and webhooks
- **Celery Beat**: Scheduled task runner
- **PostgreSQL** (postgres:15-alpine): Database on port 5432
- **Redis** (redis:7-alpine): Cache and broker on port 6379

### Production Compose File
- **Location**: `./docker-compose.prod.yml` (in root repo)
- **Usage**: Must be run from the root repo directory
  ```bash
  cd D:\Desktop\promptledger
  docker compose -f docker-compose.prod.yml up -d --build
  ```

## Configuration

### Environment Variables
- Backend configuration: `backend/.env`
- Frontend environment: `frontend/.next.config.ts` (see `rewrites()` for backend URL)
- Celery configuration: `backend/app/workers/celery_app.py`

### Key Environment Variables (backend/.env)
```
DATABASE_URL=postgresql+asyncpg://promptledger:promptledger@postgres:5432/promptledger_db
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
SECRET_KEY=<your-secret-key>
GITHUB_CLIENT_ID=<github-oauth-id>
GITHUB_CLIENT_SECRET=<github-oauth-secret>
OPENAI_API_KEY=<openai-api-key>
```

## Deployment Workflow

1. **Make changes** in the root repo:
   - Frontend changes: `frontend/app/**`
   - Backend changes: `backend/app/**`
   - Config changes: `backend/.env`, `docker-compose.prod.yml`

2. **Commit and push** to GitHub:
   ```bash
   git add .
   git commit -m "description of changes"
   git push origin main
   ```

3. **Deploy** from the root repo:
   ```bash
   cd D:\Desktop\promptledger
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. **Verify** deployment:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml logs api --tail 50
   ```

## Important Notes

- **Never use the nested `aws/terraform/promptledger_test` folder for production deployments.**
- The nested folder is a separate git repository and serves only as a local test/reference copy.
- All production code must be committed to the root repo's `main` branch.
- The docker-compose.prod.yml uses relative paths (`./backend`, `./frontend`), so it must be invoked from the root directory.
- Frontend is built and served by Next.js; there is no separate frontend container in the production stack.

## Health Checks

After deployment, verify all services are healthy:

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Expected output:
# - promptledger-postgres: healthy
# - promptledger-redis: healthy
# - promptledger-api: healthy (Up, after health check passes)
# - promptledger-celery-worker: up
# - promptledger-celery-beat: up
```

## Rollback

If deployment fails:

1. Stop the stack:
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

2. Check git history:
   ```bash
   git log --oneline -n 5
   ```

3. Revert to a previous commit if needed:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

4. Redeploy:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

## Troubleshooting

### API container keeps restarting
- Check logs: `docker compose logs api --tail 100`
- Common causes: syntax errors in Python code, missing environment variables, database connection issues

### Frontend not showing changes
- Ensure changes are in the root `frontend/` directory
- Rebuild images: `docker compose -f docker-compose.prod.yml up -d --build`
- Next.js caches builds; force rebuild with `--build`

### Database/Redis connection errors
- Verify containers are healthy: `docker compose ps`
- Check environment variables in `backend/.env`
- Ensure DATABASE_URL matches the PostgreSQL service name: `postgres` (not `localhost`)

## Links

- Root Repo: `https://github.com/Faouzia-28/promptLedger.git`
- API Documentation: `http://localhost:8000/docs` (after deployment)
- Frontend: `http://localhost:3000` or served via reverse proxy
