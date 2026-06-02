# PromptLedger

Monorepo scaffold for PromptLedger local-first implementation.

## Local Quick Start

Run the full local stack with Docker:

```bash
docker compose -f docker-compose.local.yml up --build
```

This starts:
- PostgreSQL on `localhost:5433`
- Redis on `localhost:6379`
- API on `http://localhost:8000`
- Worker for eval and background jobs
- Frontend on `http://localhost:3000`

## Local Environment Notes

- The backend defaults to Groq (`LLM_PROVIDER=grok`) because Ollama is not required for the local or hosted path.
- Set `GROQ_API_KEY` in `backend/.env` before running evals.
- The frontend should talk to the API through `/api/v1` rewrites on port `3000`.
