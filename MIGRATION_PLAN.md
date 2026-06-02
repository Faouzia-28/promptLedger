# PromptLedger Cleanup And Hosting Migration Plan

## Goal

Move PromptLedger from an EC2-centered deployment to a cleaner local-first workflow, then deploy the frontend to Vercel and the backend to Railway.

The sequence is:
1. Clean up the repository.
2. Finish and verify everything locally.
3. Migrate deployment to managed platforms.

## Phase 1: Cleanup

### Objectives

- Remove dead code, temporary fixes, and deployment workarounds.
- Separate what is production-relevant from what is only useful for local experiments.
- Standardize config and environment variable handling.
- Eliminate EC2-specific assumptions from app code where possible.

### Cleanup Targets

- Old deployment scripts in `deploy/`, `aws/`, and root-level helpers that are no longer part of the final path.
- Temporary files and generated artifacts in the repo root.
- Duplicate environment templates and overlapping deployment docs.
- Hardcoded hostnames, local IPs, and platform-specific URLs.
- Debug logging that was added only to diagnose recent issues.

### Cleanup Deliverables

- A short list of files to delete.
- A short list of files to keep and convert into canonical docs.
- A normalized environment variable strategy for frontend and backend.
- A final decision on whether background jobs stay in the same backend repo or move to a separate worker deployment.

### Exit Criteria

- The repository contains one clear production path, not multiple competing deployment paths.
- No app code depends on EC2 hostnames or manually edited server state.
- Secrets are not stored in tracked files.

## Phase 2: Finish The Project Locally

### Objectives

- Make the app run fully from the local workspace.
- Ensure frontend, backend, database, Redis, and worker processes all start cleanly.
- Verify the main user flows without relying on EC2.

### Local Completion Checklist

- Frontend boots from the local repo and talks to the local API.
- Backend boots from the local repo with migrations applied.
- Background jobs run locally and execute eval/drift tasks correctly.
- Auth works end to end with a local JWT flow.
- Drift pages, eval runs, and any dashboard views render correctly.
- Any broken or duplicated utilities are removed or consolidated.

### Local Validation Commands

Use whichever local stack becomes canonical, but the target should be a single repeatable startup path such as:

```bash
docker compose -f docker-compose.prod.yml up --build
```

Or, if the final local flow uses separate frontend and backend processes:

```bash
cd backend && ...
cd frontend && ...
```

### Exit Criteria

- A fresh clone can be started locally without EC2.
- The app is functionally complete enough that only hosting changes remain.

## Phase 3: Hosting Split

### Recommended Platform Split

- Frontend: Vercel
- Backend API: Railway
- Worker process: Railway, separate service if needed
- Database: Railway Postgres
- Redis: Railway Redis or equivalent managed service

### Why This Split

- Vercel is a natural fit for the Next.js frontend.
- Railway is better suited for long-running backend services and workers.
- Managed Postgres/Redis removes most of the EC2 operational burden.

### Platform Responsibilities

#### Vercel

- Host the Next.js frontend.
- Set `NEXT_PUBLIC_API_URL` to the Railway backend URL.
- Remove any frontend assumption that the backend is on `127.0.0.1`.

#### Railway

- Host the FastAPI backend.
- Host the Celery worker if background tasks remain.
- Provision managed Postgres and Redis if required.
- Store all backend secrets in Railway variables.

### Exit Criteria

- Frontend and backend each have one clear deployment target.
- No EC2-only deploy scripts are needed for production.

## Phase 4: Deployment Migration

### Frontend Migration Tasks

- Create a Vercel project from the frontend folder.
- Confirm build command, output directory, and environment variables.
- Update rewrites so the frontend points to the Railway backend.
- Verify auth redirects and API calls from the hosted frontend.

### Backend Migration Tasks

- Create a Railway service for the backend API.
- Add a Railway worker service if Celery remains separate.
- Connect Railway Postgres and Redis.
- Move `.env` values into Railway variables.
- Update CORS, callback URLs, webhook URLs, and frontend URLs.

### Data Migration Tasks

- Decide whether the current database is migrated or recreated cleanly.
- Export any seed data or user-critical data.
- Verify schema migrations run cleanly in the new environment.

### Exit Criteria

- The production system runs entirely on Vercel and Railway.
- EC2 is no longer part of the critical path.

## Phase 5: Cutover And Cleanup

### Tasks

- Freeze EC2 deploys before the cutover.
- Run smoke tests on the new deployment.
- Update README and deployment docs to match the new hosting model.
- Remove obsolete EC2 scripts once the new platform is stable.

### Final Exit Criteria

- Local development remains fully supported.
- Production deploys are repeatable on Vercel and Railway.
- Old hosting documentation is archived or removed.

## Suggested Work Order

1. Audit and classify files for cleanup.
2. Remove obsolete deployment and debug artifacts.
3. Stabilize the local dev and production-like setup.
4. Define the Vercel and Railway environment variables.
5. Migrate one service at a time, starting with the frontend.
6. Run smoke tests after each migration step.
7. Remove EC2-specific deployment paths only after the new stack is stable.

## Open Decisions To Confirm

- Whether Celery should stay separate on Railway or be merged into another job runner.
- Whether Redis should be managed by Railway or replaced with another hosted queue.
- Whether existing EC2 data needs to be migrated or can be reset.
- Whether the current `docker-compose.prod.yml` should remain as the local production-like stack.
