# GitHub Integration Runbook

## What Changed

- Added GitHub repository integration tables:
  - `github_integrations`
  - `github_sync_events`
- Added source provenance fields to `behavior_versions`.
- Added a GitHub sync API that can either:
  - fetch prompt file content from GitHub using a token, or
  - accept manual prompt content directly.

## Migration Steps

Run from the backend directory:

```bash
cd /opt/promptledger/backend
alembic upgrade head
```

If you are running locally:

```bash
cd backend
alembic upgrade head
```

## Service Restart

After migration, restart the API and worker so the new schema and route are active:

```bash
cd /opt/promptledger
sudo docker compose -f docker-compose.prod.yml up -d --build api celery-worker celery-beat
```

## Example Flow

1. Open the PromptLedger dashboard.
2. Go to the new GitHub Sync page.
3. Register a repository such as `owner/repo`.
4. Choose a behavior unit or let PromptLedger auto-create one.
5. Sync a prompt file from GitHub by providing:
   - repository
   - file path
   - branch/ref
   - GitHub token
6. PromptLedger creates a new `BehaviorVersion` and optionally queues an eval run.

## Example API Payload

```json
{
  "unit_name": "Support Assistant",
  "repo_full_name": "owner/repo",
  "file_path": "prompts/support/system_prompt.md",
  "github_token": "ghp_xxx",
  "github_ref": "main",
  "content": {},
  "trigger_eval": true
}
```

If `content` is empty and `github_token` is present, PromptLedger fetches the file from GitHub automatically.

## Notes

- The GitHub token is only used for the sync request and is not stored.
- If the file is JSON, PromptLedger stores the parsed JSON.
- If the file is plain text, PromptLedger stores it as `{"prompt": "..."}`.
- The sync endpoint will use the latest eval set for the selected unit if `eval_set_id` is not provided.
