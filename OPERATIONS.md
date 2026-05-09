# PromptLedger Operations

This file captures the current recovery plan for the productization backlog.

## Retry policy

- Celery is configured for late acknowledgements, single-item prefetch, and bounded retries.
- Transient worker failures on webhook processing, eval runs, drift investigation, and fingerprint computation retry up to 3 times with exponential backoff and jitter.
- Retryable failures include HTTP errors, connection errors, timeouts, and runtime network/service failures.

## Backup and restore plan

### Backup target

- Backup the PostgreSQL database with `pg_dump` in custom format.
- Store backups outside the repo, in a scheduled location such as a dated backup directory or object storage bucket.

### Backup cadence

- Take a daily full backup.
- Keep a short set of recent backups locally for quick restores, then replicate to durable storage.

### Backup command

```powershell
Set-Location backend
.\scripts\backup_restore.ps1 -Mode backup -OutputPath .\backups\promptledger.dump
```

### Restore command

```powershell
Set-Location backend
.\scripts\backup_restore.ps1 -Mode restore -InputPath .\backups\promptledger.dump
```

### Restore procedure

1. Stop the API and worker processes.
2. Restore the database from the latest valid backup.
3. Restart the API and workers.
4. Run the smoke validation flow and confirm health, login, alerts, and audit export.

### Recovery expectation

- If the database is lost, restore the latest backup and rerun the smoke checks.
- If a transient job fails, Celery retries it automatically before it is marked failed.
