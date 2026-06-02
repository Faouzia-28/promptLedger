# PromptLedger Cleanup Audit

This document is the first pass for repository cleanup before the local-completion and Vercel/Railway migration work.

## Keep As Canonical

- `README.md`
- `MIGRATION_PLAN.md`
- `docker-compose.prod.yml`
- `backend/app/**`
- `frontend/app/**`
- `backend/app/core/config.py`
- `frontend/next.config.ts`
- `frontend/package.json`

## Keep For Now, But Rewrite Or Consolidate

- `DEPLOYMENT.md`
- `OPERATIONS.md`
- `PROMPTLEDGER_ADVANCED_ROADMAP.md`
- `PHASE_3_SUMMARY.md`
- `deploy/DEPLOYMENT_*`
- `deploy/START_HERE.md`
- `deploy/QUICK_START_CHECKLIST.md`
- `deploy/ACTION_ITEMS.md`
- `deploy/GITHUB_ACTIONS_SECRETS.md`
- `deploy/GITHUB_OAUTH_SETUP.md`

These files are useful as references, but they overlap heavily and still describe the old EC2/Terraform deployment path.

## Delete Or Move Out Of The Repo

### Root-level temporary or generated artifacts

- `$null`
- `claude_handoff.zip`
- `frontend_public_deploy.zip`
- `promptledger.zip`
- `terraform.zip`
- `terraform.exe`
- `tmp_payload.json`
- `tmp_payload2.json`
- `tmp_payload3.json`
- `tmp_update_main.py`

### Sensitive or host-specific artifacts

- `promptledger_deploy`
- `deploy_key_unix`

### Terraform working artifacts

- `aws/terraform/.terraform/`
- `aws/terraform/terraform.tfstate`
- `aws/terraform/terraform.tfstate.backup`
- `aws/terraform/tfplan`
- `aws/terraform/terraform.tfvars`

### Old AWS deployment materials

- `aws/terraform/user_data_backend.sh`
- `aws/terraform/user_data_backend_docker.sh`
- `aws/terraform/user_data_frontend.sh`
- `aws/terraform/user_data_logs.sh`
- `aws/terraform/user_data_logs_docker.sh`
- `aws/terraform/main.tf`
- `aws/terraform/variables.tf`

These should not be part of the new Vercel/Railway production path. Keep them only if you still want an archived reference copy.

## Migrate Into New Hosting Docs

- Any instructions in the deploy docs that still say to run EC2, Terraform, or PM2.
- Frontend environment setup instructions should be rewritten for Vercel.
- Backend environment setup instructions should be rewritten for Railway.
- Database and worker instructions should be rewritten for managed services.

## Cleanup Order

1. Remove or relocate temporary root artifacts.
2. Remove sensitive host-only files from tracked paths.
3. Collapse deployment docs into one canonical migration guide.
4. Delete or archive EC2-only Terraform and user-data scripts after the new hosting path is stable.
5. Update all env templates to match local + Vercel + Railway settings.

## Notes

- Do not delete anything under `backend/app/**` or `frontend/app/**` until the local completion pass confirms it is unused.
- The Terraform directory still contains state and plan files that look like local working artifacts; those should not stay committed.
- If the archive value matters, move old deployment scripts into a clearly marked archive directory instead of leaving them alongside production docs.
