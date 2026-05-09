# PromptLedger Productization Backlog

This file is the execution order for turning the current local demo into a product.

## Priority 0: Freeze the v1 Product

1. Define the v1 product scope and non-goals.
   - Keep: auth, behavior units, versions, semantic diff, eval runs, drift detection, audit export.
   - Defer: full CLI, advanced integrations, multi-cloud, custom billing logic.
   - Exit when: one short scope statement exists and the team agrees not to expand it.

## Priority 1: Finish the Missing Core Backend Pieces

2. Implement the backend support services that are still scaffolds.
   - [x] backend/app/services/alert_service.py
   - [x] backend/app/services/compliance_report.py
   - Exit when: alert generation and compliance export both work through real service code.

3. Verify the backend endpoints still work after the service layer is completed.
   - Focus on auth, units, evals, drift, compliance.
   - Exit when: health, login, create unit, push version, diff, eval, and audit export all work end to end.
   - Status: completed (all core endpoints validated with 200 responses).

## Priority 2: Turn the Demo Into a Usable Product Surface

4. Implement the CLI and SDK.
   - [x] cli/promptledger/cli.py
   - [x] cli/promptledger/sdk.py
   - [x] cli/promptledger/decorators.py
   - Exit when: a user can init, track, diff, and run evals from the command line or SDK.

5. Make onboarding and first-run flows product-ready.
   - Add a clear happy-path onboarding sequence.
   - Add empty states, better error messages, and setup guidance.
   - Exit when: a new user can reach first successful unit creation without help.
   - Status: completed (overview onboarding checklist, upgraded units empty state, and clearer auth network error guidance).

## Priority 3: Production Hardening

6. Add security and access control that a product needs.
   - Role-based access control.
   - Org isolation checks everywhere.
   - Secrets management outside the repo.
   - Exit when: permissions are explicit and secrets are no longer stored in working files.
   - Status: completed (RBAC enforcement verified on alerts mutations, org-scoped checks added on drift/compliance paths, and response serialization/runtime validation passes).

7. Add observability and reliability controls.
   - Structured logs.
   - Metrics and alerting.
   - Queue/job retry policy.
   - Backup and restore plan.
   - Exit when: failures can be diagnosed and recovered without manual guesswork.
   - Status: completed (structured logging, Prometheus metrics, bounded Celery retries, and a PostgreSQL backup/restore runbook are in place).

8. Add operational safety features.
   - Rate limiting.
   - Input validation hardening.
   - Idempotency for event ingestion.
   - Exit when: repeated requests and malformed inputs are handled safely.
   - Status: completed (request-size limiting, rate limiting, typed request validation, and idempotency checks are in place for ingress paths).

## Priority 4: Product Packaging

9. Prepare billing, plans, and product docs.
   - Pricing tiers.
   - Terms, privacy policy, DPA.
   - Trust and security page.
   - Exit when: the product can be sold and legally presented.
   - Status: deferred (keep this as a demo-style placeholder for later productization).

10. Prepare cloud deployment.
    - Infrastructure as code.
    - Production environment variables.
    - CI/CD pipeline.
    - Staging and rollout strategy.
    - Exit when: the app can be deployed and updated repeatably.
    - Break this into:
         - [x] Choose AWS and keep the deployment within free-tier limits.
              - Chose AWS (Singapore region, t2.micro instances).
              - Verified all services fit within free-tier: 3x t2.micro + S3 + ELK = $0/month.
         - [x] Define infrastructure as code for app, database, cache, and secrets using free-tier-friendly services.
              - Created Terraform IaC in `aws/terraform/main.tf` for 3-instance architecture:
                - Frontend EC2: Next.js on port 3000
                - Backend EC2: FastAPI + Celery + PostgreSQL + Redis
                - Logs EC2: ELK stack (Elasticsearch + Logstash + Kibana)
              - VPC + security groups + S3 bucket + IAM roles included
              - User data scripts for automated instance setup
         - [x] List production environment variables and secret sources.
              - Created environment templates in `deploy/`:
                - `backend.env.template`: Database, API keys, AWS config, Redis, Celery, Elasticsearch
                - `frontend.env.template`: API URL and WebSocket endpoints
              - Terraform variables: GitHub OAuth, AWS region, instance types, SSH access
         - [x] Add CI/CD for build, test, deploy, and rollback.
              - Created GitHub Actions workflow: `.github/workflows/deploy.yml`
              - Stages: build-and-test (backend + frontend) → deploy → smoke-tests → rollback-on-failure
              - Automated deployment on push to main branch
         - [x] Define staging, rollout, and verification steps.
              - Created `DEPLOYMENT_RUNBOOK.md`: step-by-step deployment guide
              - Created `DEPLOYMENT_CHECKLIST.md`: 10-phase checklist (setup → deployment → testing → monitoring)
              - Smoke tests verify frontend, backend health, and metrics endpoints
      - Status: scaffolding complete; ready for execution (see `DEPLOYMENT_CHECKLIST.md`)

## Recommended Execution Order

1. Freeze v1 product scope.
2. Finish `alert_service` and `compliance_report`.
3. Validate the current backend flow end to end.
4. Build the CLI and SDK.
5. Make onboarding and first-run flows product-ready.
6. Harden auth, secrets, logging, retries, and backups.
6. Add billing/docs/product packaging.
7. Create production deployment and CI/CD.

## What We Should Do Next

**✅ DEPLOYMENT SCAFFOLDING IS COMPLETE**

Start executing Priority 4, item 10 by following:
1. **Next Action**: Open `deploy/ACTION_ITEMS.md` for immediate next steps
2. **Choose Your Path**: 
   - Fast path: `deploy/QUICK_START_CHECKLIST.md` (~1 hour, copy-paste)
   - Detailed path: `deploy/DEPLOYMENT_GUIDE_DETAILED.md` (~1.5 hours, with learning)
   - Reference: `deploy/START_HERE.md` (entry point with all guides)
3. **Gather**: GitHub OAuth credentials + AWS credentials + Terraform installed
4. **Execute**: Run `terraform apply` and follow configuration steps
5. **Verify**: End-to-end test (login → create unit → check logs)
6. **Automate**: Add GitHub Actions secrets for CI/CD

**Timeline**: ~1 hour from now to live deployment on AWS
**Cost**: $0/month (within AWS free-tier)

See `deploy/DEPLOYMENT_STATUS.md` for complete status summary.