# PromptLedger — Implementation Plan v2 (Local → AWS Free Tier)

**Tags:** `Local First` · `Ollama + Free AI` · `AWS Free Tier Deploy` · `$0 to Start`

---

## Build Strategy: Local → AWS Free Tier

> Build and test everything locally with Ollama (free AI). Deploy to AWS free tier. Zero spend to start.

**Progress Track:** ① Local Setup → ② Build Agents → ③ Frontend UI → ④ CLI & SDK → ⑤ AWS Deploy

---

## Overview & What Changes from the Original Plan

| Original (paid / external)     | New (free / local / AWS)                    |
|-------------------------------|---------------------------------------------|
| Supabase                      | AWS RDS PostgreSQL (AWS Free)               |
| Upstash Redis                 | AWS ElastiCache / local Redis (AWS Free)    |
| Cloudflare R2                 | AWS S3 (AWS Free)                           |
| Vercel hosting                | AWS Amplify / S3 + CF (AWS Free)            |
| Railway backend               | AWS EC2 t2.micro (AWS Free)                 |
| Claude / OpenAI API           | Ollama (local) → Groq free API              |
| OpenAI Embeddings             | nomic-embed / sentence-transformers         |

**The plan has two stages:**

- **Stage A — Local:** Run everything on your own machine. Ollama serves the LLM locally (no API costs). SQLite → Postgres locally. Redis locally via Docker. Frontend on localhost:3000.
- **Stage B — AWS Deploy:** After the full product is working locally, swap local services for AWS free-tier equivalents. No code changes required — only environment variables change.

---

## Free AI Options for This Project

> **Recommended stack: Ollama locally + Groq API (free tier) for production.** This costs $0 permanently and is powerful enough for all PromptLedger eval and judge tasks.

| Use case in PromptLedger         | Local (Stage A)                              | Production (Stage B)                  | Cost |
|----------------------------------|----------------------------------------------|---------------------------------------|------|
| LLM-as-judge (eval scoring)      | Ollama: llama3.1:8b or mistral:7b            | Groq API: llama-3.1-8b-instant        | $0   |
| Root cause report generation     | Ollama: llama3.1:8b                          | Groq API: llama-3.3-70b-versatile     | $0   |
| Text embeddings (fingerprinting) | sentence-transformers: all-MiniLM-L6-v2      | Same model on EC2 OR HF Inference API | $0   |
| Refusal classification           | Ollama: phi3:mini (fast, tiny)               | Groq API: gemma-7b-it                 | $0   |
| Compliance report writing        | Ollama: llama3.1:8b                          | Groq API: llama-3.3-70b-versatile     | $0   |
| Fallback if Groq is slow         | —                                            | Together AI: free tier (5B tokens)    | $0   |

**Groq Free Tier** — groq.com (sign up free): 14,400 req/day on llama-3.1-8b-instant. 30 req/min. Extremely fast (300 tok/s). No credit card. Perfect for PromptLedger's eval runs.

**Ollama (Local)** — ollama.ai (completely offline): Run LLMs locally. No API calls, no costs. llama3.1:8b needs ~6GB RAM. phi3:mini needs ~2GB. mistral:7b needs ~5GB.

> ⚠ **Fallback plan:** If your machine doesn't have enough RAM for Ollama, use Groq API for local dev too — it's free and has no usage payment. The only difference is you need internet.

---

## Local Infrastructure — What to Install on Your Machine

### 🙋 [MANUAL] Install all local prerequisites (M1, M2, M3, M4)

1. Install **Python 3.11+**: `python --version` to check. Download from python.org if needed.
2. Install **Node.js 20+**: download from nodejs.org (LTS version)
3. Install **Docker Desktop**: docker.com/get-started — needed for PostgreSQL + Redis locally
4. Install **Git**: git-scm.com
5. Install **Ollama**: go to ollama.ai → download for your OS (Mac/Linux/Windows)
6. After Ollama installs, open a terminal and run: `ollama pull llama3.1:8b` (downloads ~5GB, do while coding)
7. Also pull the small fast model: `ollama pull phi3:mini` (2GB — for quick classification tasks)
8. Install **sentence-transformers** Python lib later (Copilot will add to requirements.txt)
9. Sign up at **groq.com** → console.groq.com → API Keys → Create Key → save it
10. Sign up at **resend.com** → create free account → API Keys → create key (for email alerts)

> 💡 You don't need to wait for Ollama to finish downloading to start coding. Start the `ollama pull` command in the background and move to Phase 1 immediately.

---

## Phase 1 — Project Scaffold & Core Backend

> Copilot builds the entire skeleton. You only fill in .env values.

### P1.1 · Monorepo scaffold, database models, Alembic

#### 🤖 [COPILOT] Create full monorepo structure and install all dependencies

```
Create a monorepo for PromptLedger. Use this exact directory structure:

promptledger/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── units.py
│   │   │   ├── evals.py
│   │   │   ├── drift.py
│   │   │   ├── compliance.py
│   │   │   ├── alerts.py
│   │   │   └── webhooks.py
│   │   ├── agents/
│   │   │   ├── ingestion_agent.py
│   │   │   ├── semantic_diff_agent.py
│   │   │   ├── regression_agent.py
│   │   │   ├── drift_agent.py
│   │   │   ├── root_cause_agent.py
│   │   │   └── compliance_agent.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   └── schemas.py
│   │   ├── services/
│   │   │   ├── fingerprint_service.py
│   │   │   ├── llm_service.py      ← NEW: abstraction over Ollama/Groq
│   │   │   ├── embed_service.py    ← NEW: local sentence-transformers
│   │   │   ├── alert_service.py
│   │   │   └── compliance_report.py
│   │   ├── workers/
│   │   │   ├── celery_app.py
│   │   │   └── tasks.py
│   │   └── core/
│   │       ├── config.py
│   │       ├── database.py
│   │       └── auth.py
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── Dockerfile.worker
│   └── .env.example
├── frontend/
│   └── (Next.js — created separately)
├── cli/
│   ├── promptledger/
│   │   ├── __init__.py
│   │   ├── cli.py
│   │   ├── sdk.py
│   │   └── decorators.py
│   └── pyproject.toml
├── docker-compose.local.yml   ← local dev only
└── README.md

Step 1: Create all directories and __init__.py files.
Step 2: Create backend/requirements.txt with:
  fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg alembic
  celery redis pydantic-settings python-jose[cryptography] passlib[bcrypt]
  httpx python-multipart aiofiles boto3 reportlab click rich
  sentence-transformers numpy scipy deepeval pytest pytest-asyncio
  python-dotenv websockets

Step 3: cd backend && pip install -r requirements.txt
Step 4: cd frontend && npx create-next-app@latest . --typescript --tailwind --app
Step 5: cd frontend && npm install @radix-ui/react-dialog lucide-react recharts date-fns zustand swr axios clsx tailwind-merge
Step 6: cd frontend && npx shadcn-ui@latest init (choose default dark theme)
Step 7: npx shadcn-ui@latest add button card badge table tabs dialog sheet alert input label select textarea separator skeleton tooltip progress
```

#### 🤖 [COPILOT] Create all SQLAlchemy models and Alembic migration

```
Create backend/app/models/models.py with SQLAlchemy 2.0 async ORM models.
Use Base = declarative_base(). Import Column, String, Integer, Float, DateTime,
JSON, Text, ForeignKey, Boolean from sqlalchemy. Use UUID as primary keys (server_default=text('gen_random_uuid()')).

Models to create:

1. Organization: id(UUID PK), name(String), slug(String unique), plan(String default='free'), created_at(DateTime)
2. User: id(UUID PK), org_id(UUID FK→organizations), email(String unique), hashed_password(String), role(String default='member'), created_at(DateTime)
3. BehaviorUnit: id(UUID PK), org_id(UUID FK), name(String), description(Text), unit_type(String), created_at(DateTime)
4. BehaviorVersion: id(UUID PK), unit_id(UUID FK), version_number(Integer), content(JSON), model_config(JSON),
   created_by(UUID FK→users), git_commit(String nullable), git_branch(String nullable),
   status(String default='draft'), behavioral_fingerprint(JSON nullable, stores list of 384 floats),
   fingerprint_meta(JSON nullable), created_at(DateTime)
5. EvalSet: id(UUID PK), org_id(UUID FK), unit_id(UUID FK), name(String), cases(JSON), created_at(DateTime)
6. EvalRun: id(UUID PK), version_id(UUID FK), eval_set_id(UUID FK), status(String default='pending'),
   results(JSON nullable), score(Float nullable), triggered_by(String), created_at(DateTime), completed_at(DateTime nullable)
7. DriftEvent: id(UUID PK), unit_id(UUID FK), version_id(UUID FK nullable), severity(String),
   drift_score(Float), details(JSON), root_cause(JSON nullable), resolved(Boolean default=False),
   resolved_at(DateTime nullable), created_at(DateTime)
8. AuditLog: id(UUID PK), org_id(UUID FK), action(String), actor_id(UUID FK→users nullable),
   resource_type(String), resource_id(String), metadata(JSON), signed_hash(String), created_at(DateTime)
9. AlertConfig: id(UUID PK), org_id(UUID FK), alert_type(String), channel(String),
   config(JSON), enabled(Boolean default=True), created_at(DateTime)
10. ProductionSample: id(UUID PK), unit_id(UUID FK), input_text(Text), output_text(Text),
    embedding(JSON nullable, list of 384 floats), created_at(DateTime)

NOTE: Use JSON for embeddings instead of pgvector — we'll add pgvector later in AWS.
For now store embeddings as JSON arrays (list of floats). All distance computations happen in Python with numpy.

After models, create backend/app/core/database.py:
  - AsyncEngine with DATABASE_URL from settings
  - AsyncSessionLocal factory
  - get_db() dependency

Create backend/app/core/config.py using pydantic-settings:
  Settings class reading from .env:
  DATABASE_URL, REDIS_URL, SECRET_KEY, ALGORITHM='HS256', ACCESS_TOKEN_EXPIRE_MINUTES=1440,
  LLM_PROVIDER (ollama or groq), OLLAMA_BASE_URL='http://localhost:11434',
  GROQ_API_KEY, GROQ_MODEL='llama-3.1-8b-instant',
  OLLAMA_MODEL='llama3.1:8b', OLLAMA_FAST_MODEL='phi3:mini',
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION='us-east-1', S3_BUCKET,
  RESEND_API_KEY, FRONTEND_URL='http://localhost:3000'

Setup Alembic:
  cd backend && alembic init alembic
  Edit alembic/env.py to import Base from app.models.models and use DATABASE_URL from config
  Run: alembic revision --autogenerate -m 'initial_schema'
  (Do not run upgrade yet — we do that after local env is ready)
```

---

### P1.2 · Local Environment Setup

#### 🙋 [MANUAL] Start local Postgres + Redis with Docker and fill .env (M5, M6, M7)

This replaces Supabase and Upstash. Run locally using Docker — zero cost, zero sign-up needed.

1. Make sure Docker Desktop is running
2. In the project root, Copilot will have created **docker-compose.local.yml** — run it: `docker compose -f docker-compose.local.yml up -d`
3. This starts Postgres on port 5432 and Redis on port 6379 locally
4. Create **backend/.env** by copying backend/.env.example and filling in these values:

```
DATABASE_URL=postgresql+asyncpg://promptledger:promptledger@localhost:5432/promptledger
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-random-32-char-string-here-generate-it
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_FAST_MODEL=phi3:mini
GROQ_API_KEY=gsk_... (from groq.com — used as fallback)
GROQ_MODEL=llama-3.1-8b-instant
AWS_ACCESS_KEY_ID=leave blank for now
AWS_SECRET_ACCESS_KEY=leave blank for now
AWS_REGION=us-east-1
S3_BUCKET=leave blank for now (use local /tmp for files)
RESEND_API_KEY=re_... (from resend.com)
FRONTEND_URL=http://localhost:3000
```

5. Generate SECRET_KEY: open terminal → `python -c "import secrets; print(secrets.token_hex(32))"` → paste the output
6. Run DB migration: `cd backend && alembic upgrade head`
7. Test DB connection: `cd backend && python -c "from app.core.database import engine; print('DB OK')"`

#### 🤖 [COPILOT] Create docker-compose.local.yml for Postgres + Redis

```yaml
# Create docker-compose.local.yml in the project root:

version: '3.8'
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: promptledger
      POSTGRES_PASSWORD: promptledger
      POSTGRES_DB: promptledger
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U promptledger']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  postgres_data:
  redis_data:

# Also create backend/.env.example with all keys listed as empty strings and comments explaining each.
# Also create a Makefile in backend/ with:
#   make dev     → uvicorn app.main:app --reload --port 8000
#   make worker  → celery -A app.workers.celery_app worker --loglevel=info
#   make migrate → alembic upgrade head
#   make test    → pytest tests/
```

---

### P1.3 · FastAPI Application and LLM Service Abstraction

#### 🤖 [COPILOT] Build LLMService and EmbedService — the AI abstraction layer

```python
# Create backend/app/services/llm_service.py:

from app.core.config import settings
import httpx, json

class LLMService:
    '''Unified LLM interface. Uses Ollama locally, Groq in production.
       Switch by setting LLM_PROVIDER=ollama or LLM_PROVIDER=groq in .env'''

    async def chat(self, messages: list[dict], temperature: float = 0.1, max_tokens: int = 2000) -> str:
        if settings.LLM_PROVIDER == 'ollama':
            return await self._ollama_chat(messages, temperature, max_tokens)
        else:
            return await self._groq_chat(messages, temperature, max_tokens)

    async def _ollama_chat(self, messages, temperature, max_tokens) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f'{settings.OLLAMA_BASE_URL}/api/chat',
                json={'model': settings.OLLAMA_MODEL, 'messages': messages,
                      'stream': False, 'options': {'temperature': temperature, 'num_predict': max_tokens}}
            )
            return r.json()['message']['content']

    async def _groq_chat(self, messages, temperature, max_tokens) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers={'Authorization': f'Bearer {settings.GROQ_API_KEY}'},
                json={'model': settings.GROQ_MODEL, 'messages': messages,
                      'temperature': temperature, 'max_tokens': max_tokens}
            )
            return r.json()['choices'][0]['message']['content']

    async def fast_chat(self, messages: list[dict]) -> str:
        'Use the smaller/faster model for quick classification tasks'
        if settings.LLM_PROVIDER == 'ollama':
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(
                    f'{settings.OLLAMA_BASE_URL}/api/chat',
                    json={'model': settings.OLLAMA_FAST_MODEL, 'messages': messages, 'stream': False}
                )
                return r.json()['message']['content']
        else:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    headers={'Authorization': f'Bearer {settings.GROQ_API_KEY}'},
                    json={'model': 'gemma-7b-it', 'messages': messages, 'max_tokens': 500}
                )
                return r.json()['choices'][0]['message']['content']

# Singleton
llm = LLMService()

# ---

# Create backend/app/services/embed_service.py:

from sentence_transformers import SentenceTransformer
import numpy as np

class EmbedService:
    '''Local embeddings using sentence-transformers all-MiniLM-L6-v2.
       384 dimensions, runs fully offline, no API needed ever.'''

    def __init__(self):
        self._model = None  # lazy load

    @property
    def model(self):
        if self._model is None:
            self._model = SentenceTransformer('all-MiniLM-L6-v2')
        return self._model

    def embed(self, text: str) -> list[float]:
        vec = self.model.encode(text, normalize_embeddings=True)
        return vec.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        vecs = self.model.encode(texts, normalize_embeddings=True, batch_size=32)
        return vecs.tolist()

    def cosine_distance(self, a: list[float], b: list[float]) -> float:
        va, vb = np.array(a), np.array(b)
        return float(1 - np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb)))

    def centroid(self, embeddings: list[list[float]]) -> list[float]:
        return np.mean(np.array(embeddings), axis=0).tolist()

# Singleton
embedder = EmbedService()
```

#### 🤖 [COPILOT] Build full FastAPI application: main.py, auth, all CRUD endpoints, WebSocket

```
Build backend/app/main.py:
- Create FastAPI app with title='PromptLedger API', version='1.0.0'
- Add CORS middleware: allow_origins=['http://localhost:3000', settings.FRONTEND_URL], allow_credentials=True, allow_methods=['*'], allow_headers=['*']
- Include all routers at prefix /api/v1
- GET /health → return {'status': 'ok', 'llm_provider': settings.LLM_PROVIDER}
- Add startup event: log which LLM provider is active

Build backend/app/core/auth.py:
- JWT token creation and verification with python-jose
- get_current_user dependency injection
- Bcrypt password hashing with passlib

Build backend/app/api/auth.py:
- POST /auth/register: create Organization + User, return access_token
- POST /auth/login: verify credentials, return access_token
- GET /auth/me: return current user info

Build backend/app/api/units.py (full CRUD):
- GET /units: list all BehaviorUnits for current user's org
- POST /units: create new BehaviorUnit
- GET /units/{id}: get with latest version info
- POST /units/{id}/versions: create new BehaviorVersion (auto-increment version_number)
- GET /units/{id}/versions: full version history
- POST /units/{id}/versions/{vid}/deploy: set status=deployed, set all others to rolled_back
- POST /units/{id}/versions/{vid}/rollback: set status=deployed, create audit log entry
- GET /units/{id}/diff/{v1_num}/{v2_num}: return both version contents for frontend diff display

Build backend/app/api/evals.py:
- POST /eval-sets: create EvalSet with test cases
- GET /eval-sets: list for org
- POST /eval-runs: create EvalRun, enqueue Celery task run_eval.delay(run_id), return {run_id}
- GET /eval-runs/{id}: return run with status and results (for polling)
- GET /units/{id}/eval-runs: list eval runs for a unit

Build backend/app/api/drift.py:
- GET /drift-events: list for org, filter by severity/unit/resolved
- GET /drift-events/{id}: full event with root_cause
- POST /drift-events/{id}/resolve: mark resolved, timestamp
- POST /ingest/output: receive production output sample, store + queue drift check

Build backend/app/api/compliance.py:
- GET /audit-log: paginated audit log (50/page) for org
- GET /compliance/export: trigger export, return S3 presigned URL (or local file path for dev)
- GET /compliance/eu-ai-act-report: generate report JSON for date range

Build backend/app/api/alerts.py: full CRUD for AlertConfig

Add WebSocket in main.py:
- @app.websocket('/ws/drift/{org_id}')
- Keep connection alive, send ping every 30s
- Store active connections in a dict: org_connections: dict[str, list[WebSocket]]
- Create broadcast_drift(org_id, event) function used by drift agent
```

---

## Phase 2 — The 6-Agent Pipeline

> All agents use LLMService (Ollama/Groq) and EmbedService (sentence-transformers). No paid APIs.

### Agent 1 · Ingestion — "The Watcher"

#### 🤖 [COPILOT] Build IngestionAgent + GitHub webhook handler

```python
# Create backend/app/agents/ingestion_agent.py:

class IngestionAgent:
    PROMPT_PATTERNS = ['system_prompt', 'prompt', 'system_message', 'user_prompt', 'instructions']
    CONFIG_KEYS = ['model', 'temperature', 'max_tokens', 'top_p', 'tools', 'retrieval_config']

    async def process_github_push(self, db, payload: dict) -> list[str]:
        'Process a GitHub push webhook. Returns list of created version IDs.'
        org_id = await self._resolve_org_from_repo(db, payload['repository']['full_name'])
        if not org_id:
            return []
        created = []
        for commit in payload.get('commits', []):
            for filepath in commit.get('modified', []) + commit.get('added', []):
                if self._is_prompt_file(filepath):
                    content = await self._fetch_file_content(payload, filepath)
                    if content:
                        version = await self._create_draft_version(db, org_id, filepath, content, commit)
                        created.append(str(version.id))
        return created

    def _is_prompt_file(self, path: str) -> bool:
        extensions = ['.txt', '.md', '.yaml', '.yml', '.json']
        keywords = ['prompt', 'instruction', 'system', 'template']
        return any(path.endswith(ext) for ext in extensions) and \
               any(kw in path.lower() for kw in keywords)

    async def process_sdk_call(self, db, unit_name: str, org_id: str, payload: dict):
        'Called when SDK sends a captured LLM call config'
        pass

# Create backend/app/api/webhooks.py:
# - POST /webhooks/github: verify HMAC signature with GITHUB_WEBHOOK_SECRET,
#   call ingestion_agent.process_github_push.delay(), return 200
# - POST /webhooks/sdk/{webhook_token}: no auth (token IS the auth), call process_sdk_call
# - POST /ingest/output: receive {unit_name, input, output, model} from SDK,
#   store ProductionSample, queue drift check

# Create Celery tasks/tasks.py — add task:
# process_github_webhook(payload: dict) → calls IngestionAgent
```

---

### Agent 2 · Semantic Diff — "The Comparator"

#### 🤖 [COPILOT] Build SemanticDiffAgent using local embeddings + Ollama judge

```python
# Create backend/app/agents/semantic_diff_agent.py:

from app.services.llm_service import llm
from app.services.embed_service import embedder
import json

class SemanticDiffAgent:
    async def compare_versions(self, old_version, new_version, eval_cases: list[dict]) -> dict:
        '''
        Compare two BehaviorVersions behaviorally.
        eval_cases = list of {input, expected_output} from EvalSet
        Uses local embeddings + Ollama LLM judge. Zero API cost.
        '''
        N = min(len(eval_cases), 15)  # sample up to 15 cases
        sample = eval_cases[:N]

        old_outputs, new_outputs = [], []
        for case in sample:
            old_out = await self._run_version(old_version, case['input'])
            new_out = await self._run_version(new_version, case['input'])
            old_outputs.append(old_out)
            new_outputs.append(new_out)

        old_embeds = embedder.embed_batch(old_outputs)
        new_embeds = embedder.embed_batch(new_outputs)

        old_centroid = embedder.centroid(old_embeds)
        new_centroid = embedder.centroid(new_embeds)
        embedding_distance = embedder.cosine_distance(old_centroid, new_centroid)

        old_refusals = await self._count_refusals(old_outputs)
        new_refusals = await self._count_refusals(new_outputs)
        refusal_delta = (new_refusals - old_refusals) / N

        import random
        judge_pairs = random.sample(list(zip(old_outputs, new_outputs)), min(3, N))
        judge_scores = []
        for old_o, new_o in judge_pairs:
            score = await self._judge_pair(case['input'], old_o, new_o)
            judge_scores.append(score)

        avg_score = {k: sum(s[k] for s in judge_scores) / len(judge_scores) for k in judge_scores[0]} if judge_scores else {}
        summary = await self._generate_summary(embedding_distance, refusal_delta, avg_score)

        return {
            'embedding_distance': round(embedding_distance, 4),
            'refusal_rate_delta': round(refusal_delta, 4),
            'length_delta': round((sum(len(o) for o in new_outputs) - sum(len(o) for o in old_outputs)) / N, 1),
            'judge_scores': avg_score,
            'summary': summary,
            'samples_compared': N
        }

    async def _judge_pair(self, input_text: str, old_output: str, new_output: str) -> dict:
        prompt = f'''Compare these two AI responses to the same input.
Input: {input_text[:200]}
Response A: {old_output[:300]}
Response B: {new_output[:300]}

Rate the CHANGE from A to B on each dimension (-2=much worse, 0=same, +2=much better):
Return ONLY valid JSON: {{"tone": 0, "accuracy": 0, "safety": 0, "helpfulness": 0}}'''
        result = await llm.fast_chat([{'role': 'user', 'content': prompt}])
        try:
            return json.loads(result.strip())
        except:
            return {'tone': 0, 'accuracy': 0, 'safety': 0, 'helpfulness': 0}
```

---

### Agent 3 · Regression Gate — "The Gatekeeper"

#### 🤖 [COPILOT] Build RegressionAgent + Celery eval runner task

```python
# Create backend/app/agents/regression_agent.py:

class RegressionAgent:
    async def run_eval(self, db, eval_run_id: str):
        '''Full eval run against an EvalSet. Updates EvalRun in DB as it runs.'''
        run = await db.get(EvalRun, eval_run_id)
        eval_set = await db.get(EvalSet, run.eval_set_id)
        version = await db.get(BehaviorVersion, run.version_id)

        await self._update_run_status(db, run, 'running')

        results = []
        for i, case in enumerate(eval_set.cases):
            output = await self._run_version(version, case['input'])
            score = await self._score_output(case, output)
            results.append({
                'case_index': i,
                'input': case['input'],
                'expected': case.get('expected_output', ''),
                'actual': output,
                'score': score['overall'],
                'breakdown': score,
                'passed': score['overall'] >= 0.7
            })

        total_score = sum(r['score'] for r in results) / len(results)
        failed_count = sum(1 for r in results if not r['passed'])
        fail_rate = failed_count / len(results)

        if fail_rate == 0:
            status = 'passed'
        elif fail_rate <= 0.2:
            status = 'degraded'
        else:
            status = 'failed'

        await self._update_run_complete(db, run, status, results, total_score)
        if status == 'failed':
            await self._trigger_alert(db, run, results)
        return status, total_score

    async def _score_output(self, case: dict, output: str) -> dict:
        criteria = case.get('criteria', 'Is this response accurate, helpful, and relevant to the input?')
        prompt = f'''Score this AI response 0.0 to 1.0.
Input: {case['input'][:300]}
Expected behavior: {criteria}
Actual output: {output[:400]}
Return ONLY valid JSON: {{"overall": 0.85, "relevance": 0.9, "accuracy": 0.8, "reasoning": "brief explanation"}}'''
        result = await llm.fast_chat([{'role': 'user', 'content': prompt}])
        try:
            return json.loads(result.strip())
        except:
            return {'overall': 0.5, 'relevance': 0.5, 'accuracy': 0.5, 'reasoning': 'parse error'}

# Add Celery task in workers/tasks.py:
# @celery_app.task
# def run_regression_eval(eval_run_id: str):
#     import asyncio
#     from app.agents.regression_agent import RegressionAgent
#     agent = RegressionAgent()
#     asyncio.run(agent.run_eval_with_db(eval_run_id))
```

---

### Agent 4 · Drift Sentinel — "The Sentinel"

#### 🤖 [COPILOT] Build DriftAgent with Celery beat scheduled checks

```python
# Create backend/app/agents/drift_agent.py:

class DriftAgent:
    DRIFT_THRESHOLD = 0.15         # cosine distance above this = drift
    REFUSAL_DELTA_THRESHOLD = 0.1  # 10% refusal rate change = drift

    async def store_production_sample(self, db, unit_id: str, input_text: str, output_text: str):
        embedding = embedder.embed(output_text)
        sample = ProductionSample(unit_id=unit_id, input_text=input_text,
                                   output_text=output_text, embedding=embedding)
        db.add(sample)
        await db.commit()

    async def check_drift_for_unit(self, db, unit_id: str):
        'Called by Celery beat every 30 minutes for each deployed unit.'
        version = await self._get_deployed_version(db, unit_id)
        if not version or not version.behavioral_fingerprint:
            return

        baseline = np.array(version.behavioral_fingerprint)
        samples = await self._get_recent_samples(db, unit_id, limit=50)
        if len(samples) < 10:
            return

        recent_embeddings = [np.array(s.embedding) for s in samples if s.embedding]
        if len(recent_embeddings) < 5:
            return

        recent_centroid = np.mean(recent_embeddings, axis=0)
        drift_score = embedder.cosine_distance(baseline.tolist(), recent_centroid.tolist())

        if drift_score > self.DRIFT_THRESHOLD:
            severity = self._severity_from_score(drift_score)
            event = DriftEvent(unit_id=unit_id, version_id=version.id,
                               severity=severity, drift_score=drift_score,
                               details={'samples_analyzed': len(recent_embeddings)})
            db.add(event)
            await db.commit()
            from app.main import broadcast_drift
            await broadcast_drift(str(version.org_id_from_unit), {
                'type': 'drift_detected', 'severity': severity,
                'drift_score': drift_score, 'unit_id': unit_id
            })
            from app.workers.tasks import investigate_drift
            investigate_drift.delay(str(event.id))

    def _severity_from_score(self, score: float) -> str:
        if score < 0.2: return 'low'
        if score < 0.35: return 'medium'
        if score < 0.5: return 'high'
        return 'critical'

# Add to workers/celery_app.py:
# app.conf.beat_schedule = {
#     'check-drift-every-30min': {
#         'task': 'app.workers.tasks.run_all_drift_checks',
#         'schedule': 1800,
#     }
# }
```

---

### Agent 5 · Root Cause — "The Detective"

#### 🤖 [COPILOT] Build RootCauseAgent — generates incident reports with Ollama

```python
# Create backend/app/agents/root_cause_agent.py:

class RootCauseAgent:
    async def investigate(self, db, drift_event_id: str) -> dict:
        event = await db.get(DriftEvent, drift_event_id)
        unit = await db.get(BehaviorUnit, event.unit_id)

        recent_deploys = await self._get_recent_versions(db, event.unit_id, hours_before=24)
        recent_failed_evals = await self._get_recent_failed_evals(db, event.unit_id, hours_before=48)
        sample_analysis = await self._analyze_sample_distribution(db, event.unit_id)

        context = {
            'drift_event': {
                'severity': event.severity,
                'drift_score': event.drift_score,
                'detected_at': str(event.created_at),
                'details': event.details
            },
            'recent_deployments': [{'version': v.version_number, 'at': str(v.created_at)} for v in recent_deploys],
            'recent_failed_evals': len(recent_failed_evals),
            'sample_analysis': sample_analysis
        }

        prompt = f'''You are an AI reliability engineer analyzing a behavioral drift incident.
Context: {json.dumps(context, indent=2)}

Generate a root cause analysis as JSON with these exact keys:
{{
  "most_likely_cause": "one of: prompt_change, model_provider_update, data_distribution_shift, known_degradation, unknown",
  "confidence": 0.0-1.0,
  "timeline": ["list of relevant events in order"],
  "affected_segments": "description of who is affected",
  "recommended_action": "specific actionable recommendation",
  "resolution_steps": ["step 1", "step 2", "step 3"]
}}
Return ONLY the JSON, no markdown.'''

        result = await llm.chat([{'role': 'user', 'content': prompt}], max_tokens=800)
        try:
            report = json.loads(result.strip())
        except:
            report = {'most_likely_cause': 'unknown', 'confidence': 0, 'recommended_action': 'Manual investigation required'}

        event.root_cause = report
        await db.commit()
        return report
```

---

### Agent 6 · Audit Notary — "The Notary"

#### 🤖 [COPILOT] Build ComplianceAgent + signed audit log + EU AI Act report

```python
# Create backend/app/agents/compliance_agent.py:

import hmac, hashlib, json

class ComplianceAgent:
    def sign_entry(self, entry: dict) -> str:
        payload = json.dumps(entry, sort_keys=True, default=str)
        return hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()

    async def write_audit_log(self, db, action, actor_id, org_id, resource_type, resource_id, metadata={}):
        entry = {'action': action, 'actor_id': actor_id, 'org_id': org_id,
                 'resource_type': resource_type, 'resource_id': resource_id,
                 'metadata': metadata, 'timestamp': str(datetime.utcnow())}
        signed = self.sign_entry(entry)
        log = AuditLog(org_id=org_id, action=action, actor_id=actor_id,
                       resource_type=resource_type, resource_id=resource_id,
                       metadata=metadata, signed_hash=signed)
        db.add(log)
        await db.commit()

    async def generate_eu_ai_act_report(self, db, org_id, from_date, to_date) -> dict:
        units = await self._get_units(db, org_id)
        all_versions = await self._get_versions_in_period(db, org_id, from_date, to_date)
        all_drift = await self._get_drift_events(db, org_id, from_date, to_date)
        audit_entries = await self._get_audit_log(db, org_id, from_date, to_date)

        summary_prompt = f'''Write a 3-sentence EU AI Act Article 13 transparency statement for an AI governance system.
Period: {from_date} to {to_date}. Units monitored: {len(units)}. Versions deployed: {len(all_versions)}. Drift incidents: {len(all_drift)}.
Be formal and compliant. No markdown.'''
        narrative = await llm.chat([{'role': 'user', 'content': summary_prompt}], max_tokens=300)

        return {
            'report_type': 'EU_AI_Act_Article_13_Transparency_Report',
            'generated_at': str(datetime.utcnow()),
            'reporting_period': {'from': str(from_date), 'to': str(to_date)},
            'executive_summary': narrative,
            'ai_systems_monitored': len(units),
            'audit_log_entry_count': len(audit_entries),
            'data_governance_statement': 'Production outputs sampled per GDPR Art. 5 data minimisation principle.'
        }

# Also:
# Create backend/app/services/compliance_report.py:
# - generate_pdf(report_dict: dict) -> bytes using ReportLab
# - Cover page, org name, period, sections per AI system

# Add middleware to main.py that calls compliance_agent.write_audit_log()
# on every POST/PUT/DELETE request.
```

---

### Behavioral Fingerprinting Service

#### 🤖 [COPILOT] Build FingerprintService

```python
# Create backend/app/services/fingerprint_service.py:

class FingerprintService:
    async def compute_and_store(self, db, version_id: str, eval_set_id: str):
        '''
        Run N eval cases through the version, embed all outputs,
        compute centroid as the fingerprint. Store in BehaviorVersion.
        Triggered after deploy.
        '''
        version = await db.get(BehaviorVersion, version_id)
        eval_set = await db.get(EvalSet, eval_set_id)

        N = min(len(eval_set.cases), 30)
        outputs = []
        for case in eval_set.cases[:N]:
            out = await self._run_version(version, case['input'])
            outputs.append(out)

        embeddings = embedder.embed_batch(outputs)
        fingerprint = embedder.centroid(embeddings)  # 384-dim vector

        refusal_count = 0
        for out in outputs:
            msg = [{'role':'user','content':f'Is this a refusal? yes/no only.\n{out[:200]}'}]
            r = await llm.fast_chat(msg)
            if 'yes' in r.lower():
                refusal_count += 1

        meta = {
            'refusal_rate': refusal_count / N,
            'mean_output_length': sum(len(o) for o in outputs) / N,
            'embedding_variance': float(np.mean(np.var(np.array(embeddings), axis=0))),
            'sample_count': N
        }

        version.behavioral_fingerprint = fingerprint
        version.fingerprint_meta = meta
        await db.commit()
        return fingerprint, meta

# Add Celery task: compute_fingerprint.delay(version_id, eval_set_id)
# Trigger this from the deploy endpoint after version.status = 'deployed'
```

---

## Phase 3 — Client-Facing Frontend UI

> Next.js 14 — dark theme, full feature dashboard

### P3.1 · App shell, auth, layout

#### 🤖 [COPILOT] Build app shell, dark theme, layout, and auth pages

```
Build the Next.js frontend:

1. app/globals.css: Dark theme CSS variables:
   --background: 240 10% 4%;
   --foreground: 240 10% 95%;
   --primary: 250 90% 72%;     (purple)
   --muted: 240 10% 10%;
   --muted-foreground: 240 10% 55%;
   --border: 240 10% 16%;
   --card: 240 10% 7%;

2. app/layout.tsx: JetBrains Mono + DM Sans from Google Fonts, dark background

3. app/(auth)/login/page.tsx:
   - Centered card (max-w-sm), logo at top
   - Email + password inputs, Login button
   - POST to /api/v1/auth/login, store JWT in localStorage, redirect to /dashboard
   - Link to /register

4. app/(auth)/register/page.tsx:
   - Org name + email + password
   - POST to /api/v1/auth/register

5. app/(dashboard)/layout.tsx:
   - Sidebar (220px): logo, nav links, user info at bottom
   - Nav items with icons (lucide-react): Overview, Behavior Units, Eval Runs, Drift Events, Audit Log, Settings
   - Main content area

6. lib/api.ts: axios instance, baseURL from NEXT_PUBLIC_API_URL,
   request interceptor adds Authorization: Bearer {token from localStorage}
   response interceptor: 401 → redirect to /login

7. lib/hooks.ts: SWR hooks:
   useBehaviorUnits(), useDriftEvents(), useEvalRuns(), useAuditLog(), useDriftEventById(id)
```

### P3.2 · All dashboard pages

#### 🤖 [COPILOT] Overview page + real-time WebSocket drift notifications

```
Create app/(dashboard)/overview/page.tsx:

Top metric cards (4 in a row):
- Total Behavior Units | Active Drift Events (red badge if > 0) | Eval Pass Rate (7d) | System Health

Below: 2-column grid
Left (60%): Recent Drift Events table (severity colored badge, unit name, time, Investigate button)
Right (40%): Unit Health list (each unit: name, small progress bar for drift score, status dot)

Bottom: Recharts AreaChart — drift score over last 7 days

WebSocket connection:
- In a useEffect, connect to ws://localhost:8000/ws/drift/{org_id}
- On message: show a toast notification with severity color
- Auto-reconnect on disconnect with exponential backoff (1s, 2s, 4s, max 30s)

Create app/(dashboard)/units/page.tsx:
- Grid of BehaviorUnit cards (name, type badge, latest version number, drift status dot)
- 'New Unit' button → Dialog with form (name, description, type selector)
- Each card links to /units/[id]

Create app/(dashboard)/units/[id]/page.tsx:
- Tabs: Overview | Versions | Diff | Eval Results
- Overview: unit info + fingerprint radar chart (Recharts RadarChart, 5 axes)
- Versions tab: vertical timeline — each version shows number, status badge, branch, author, date
  Action buttons: Deploy, Run Eval, View Diff, Rollback
- Diff tab: two version selectors, side-by-side text comparison with highlighted changes
- Eval Results: table of EvalRuns with score, status, date

Create app/(dashboard)/drift/page.tsx:
- Filter row: severity select, unit select, show resolved toggle
- Table: severity icon, unit name, drift score bar, time, resolve button

Create app/(dashboard)/drift/[id]/page.tsx:
- Severity header banner (color by severity)
- Root Cause Report card: most_likely_cause (highlighted), confidence badge, timeline list, recommended_action
- Drift score trend (Recharts LineChart)
- Action buttons: Rollback to vN, Mark Resolved

Create app/(dashboard)/audit/page.tsx:
- Export buttons: EU AI Act Report (JSON download) and Audit Log (NDJSON download)
- Date range picker using input[type=date]
- Paginated table: timestamp | actor | action badge | resource | hash (8 chars + copy icon)

Create app/(dashboard)/settings/page.tsx:
- Tabs: Integrations | Alerts | Team
- Integrations: shows GitHub webhook URL + token, Slack webhook input
- Alerts: drift threshold slider, email address input, test alert button
- Team: invite by email, member list
```

---

## Phase 4 — CLI, SDK & GitHub Action

> The open-source developer tools that drive adoption

### P4.1 · Python SDK + CLI

#### 🤖 [COPILOT] Build full CLI (Click) + SDK wrapper + pyproject.toml

```python
# Build cli/promptledger/sdk.py:

class PromptLedger:
    def __init__(self, api_key: str, base_url: str = 'http://localhost:8000'):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')

    def track(self, unit_name: str, input_text: str, output_text: str, model: str = '', version: str = ''):
        'Fire-and-forget: POST to /ingest/output. Never blocks.'
        import threading
        threading.Thread(target=self._post_sample, args=(unit_name, input_text, output_text, model), daemon=True).start()

    def wrap_openai(self, openai_client):
        'Monkey-patch OpenAI client.chat.completions.create to auto-track'
        original = openai_client.chat.completions.create
        pl = self
        def patched(*args, **kwargs):
            result = original(*args, **kwargs)
            prompt = str(kwargs.get('messages', ''))
            output = result.choices[0].message.content or ''
            model = kwargs.get('model', '')
            pl.track('openai-default', prompt, output, model)
            return result
        openai_client.chat.completions.create = patched
        return openai_client

# Build cli/promptledger/cli.py with Click:

# @click.group()
# def main(): 'PromptLedger CLI'

# @main.command()
# def init():
#     'Interactive setup — asks for API key, tests connection, writes ~/.promptledger/config.yml'

# @main.command()
# def push(file, unit, message):
#     'Push a prompt file as new BehaviorVersion'

# @main.command()
# def diff(v1, v2, unit):
#     'Semantic diff between two versions — print table of metrics with rich'

# @main.command('eval')
# def run_eval(unit, eval_set, wait):
#     'Trigger eval run. --wait polls and streams progress with rich Progress bar'

# @main.command()
# def status():
#     'Print drift status for all units as a rich Table'

# Build cli/pyproject.toml:
# [project]
# name = 'promptledger'
# version = '0.1.0'
# dependencies = ['click', 'rich', 'httpx', 'pyyaml']
# [project.scripts]
# promptledger = 'promptledger.cli:main'
```

### P4.2 · GitHub Actions CI Gate

#### 🤖 [COPILOT] Create reusable GitHub Action + example workflow

```yaml
# Create .github/actions/promptledger-gate/action.yml:

name: 'PromptLedger Eval Gate'
description: 'Run behavioral regression tests and block deployment if they fail'
inputs:
  api_key: { required: true, description: 'PromptLedger API key' }
  api_url: { required: true, description: 'PromptLedger API URL' }
  unit_name: { required: true, description: 'BehaviorUnit to test' }
  eval_set_name: { required: true, description: 'EvalSet to run' }
  fail_threshold: { default: '0.8', description: 'Fail if score below this' }

runs:
  using: 'composite'
  steps:
    - run: pip install promptledger
    - run: |
        promptledger eval ${{ inputs.unit_name }} \
          --eval-set ${{ inputs.eval_set_name }} \
          --wait \
          --fail-below ${{ inputs.fail_threshold }}
      env:
        PROMPTLEDGER_API_KEY: ${{ inputs.api_key }}
        PROMPTLEDGER_API_URL: ${{ inputs.api_url }}

# Also create docs/github-action-example.yml showing usage.
```

---

## Phase 5 — Deploy to AWS Free Tier

> Do this only after the full product works locally. Only env vars change — no code changes needed.

### AWS Free Tier Service Map

| What we need        | AWS Service                        | Free Tier Limit                          | Replaces        |
|---------------------|-------------------------------------|------------------------------------------|-----------------|
| Backend hosting     | EC2 t2.micro                        | 750 hrs/mo × 12 months                   | Railway         |
| PostgreSQL database | RDS db.t3.micro (PostgreSQL 15)     | 750 hrs/mo × 12 months, 20GB             | Supabase        |
| Redis (task queue)  | ElastiCache t2.micro OR Redis on EC2| 750 hrs/mo (ElastiCache) or free on EC2  | Upstash         |
| File storage        | S3 Standard                         | 5GB, 20k GET, 2k PUT/mo                  | Cloudflare R2   |
| Frontend hosting    | S3 + CloudFront                     | 1TB CDN transfer/mo × 12 months          | Vercel          |
| Email alerts        | SES (Simple Email Service)          | 62k emails/mo (from EC2)                 | Resend          |
| DNS                 | Route 53                            | $0.50/zone/mo — skip if no custom domain | —               |
| Secrets management  | SSM Parameter Store                 | Free (standard tier)                     | .env file       |

> ⚠ **AWS free tier requires a credit card to sign up, but charges $0 if you stay within limits.** Set a billing alert at $1 as a safety net.

> 💡 **ElastiCache vs Redis on EC2:** To save free-tier hours, you can run Redis directly on the same EC2 t2.micro. Just run `sudo apt install redis-server` on the EC2 instance.

---

### 🙋 [MANUAL] Create AWS account and set up free tier services (M10, M11)

1. Go to **aws.amazon.com** → Create a Free Tier account (requires credit card, $0 charged if you stay in limits)
2. After login: go to **Billing → Billing Preferences → Alert Preferences** → enable "Receive Free Tier Usage Alerts" → also create a CloudWatch billing alarm at $1 threshold
3. **Create EC2 instance:** EC2 → Launch Instance → Amazon Linux 2023 → t2.micro → Create new key pair (download .pem file) → Security Group: allow ports 22 (SSH), 8000 (API), 80, 443
4. **Create RDS:** RDS → Create Database → PostgreSQL 15 → Free tier template → db.t3.micro → set username=promptledger, password=your-password → VPC: same as EC2 → initial DB name: promptledger
5. Note the RDS **endpoint URL** (looks like: `promptledger.xxx.us-east-1.rds.amazonaws.com`)
6. **Create S3 bucket:** S3 → Create bucket → name: promptledger-yourname (must be globally unique) → Region: us-east-1 → Block all public access: ON
7. **Create IAM user for app:** IAM → Users → Create user → name: promptledger-app → attach policies: AmazonS3FullAccess, AmazonSESFullAccess → Create Access Key → download CSV
8. **Verify SES email:** SES → Verified Identities → Create Identity → Email address → verify → this is your FROM address for alerts
9. **CloudFront for frontend (optional):** can skip until you need HTTPS — S3 static hosting works fine for demo

---

### P5 · Deployment — Copilot creates config, you execute commands

#### 🤖 [COPILOT] Create all AWS deployment scripts and config files

```dockerfile
# 1. backend/Dockerfile (production):
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

```bash
# 2. deploy/setup-ec2.sh (run on EC2 after SSH in):
#!/bin/bash
sudo yum update -y
sudo yum install -y docker git
sudo service docker start
sudo usermod -a -G docker ec2-user
sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo yum install -y redis6
sudo systemctl enable redis6
sudo systemctl start redis6
echo 'Setup complete'
```

```yaml
# 3. deploy/docker-compose.prod.yml (runs on EC2):
version: '3.8'
services:
  api:
    build: .
    ports:
      - '8000:8000'
    env_file: .env.prod
    restart: unless-stopped
  worker:
    build: .
    command: celery -A app.workers.celery_app worker --loglevel=info
    env_file: .env.prod
    restart: unless-stopped
  beat:
    build: .
    command: celery -A app.workers.celery_app beat --loglevel=info
    env_file: .env.prod
    restart: unless-stopped
```

```bash
# 4. deploy/deploy.sh (run locally to deploy to EC2):
#!/bin/bash
EC2_IP='YOUR_EC2_PUBLIC_IP'
EC2_KEY='~/path/to/your-key.pem'
echo 'Copying files to EC2...'
scp -i $EC2_KEY -r backend/ ec2-user@$EC2_IP:~/promptledger/
scp -i $EC2_KEY deploy/docker-compose.prod.yml ec2-user@$EC2_IP:~/promptledger/
echo 'Building and starting...'
ssh -i $EC2_KEY ec2-user@$EC2_IP 'cd ~/promptledger && docker-compose -f docker-compose.prod.yml up -d --build'
echo 'Running migrations...'
ssh -i $EC2_KEY ec2-user@$EC2_IP 'cd ~/promptledger && docker-compose exec api alembic upgrade head'
echo "Done. API running at http://$EC2_IP:8000"
```

```bash
# 5. deploy/deploy-frontend.sh:
#!/bin/bash
S3_BUCKET='promptledger-yourname'
echo 'Building Next.js...'
cd frontend && npm run build
echo 'Uploading to S3...'
aws s3 sync out/ s3://$S3_BUCKET --delete
echo "Done. Frontend at: http://$S3_BUCKET.s3-website-us-east-1.amazonaws.com"
```

```bash
# 6. backend/.env.prod.example (AWS values):
DATABASE_URL=postgresql+asyncpg://promptledger:PASSWORD@YOUR-RDS-ENDPOINT:5432/promptledger
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=YOUR-32-CHAR-SECRET
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=promptledger-yourname
RESEND_API_KEY=re_...
FRONTEND_URL=http://YOUR-S3-WEBSITE-URL
```

#### 🙋 [MANUAL] Execute deployment to AWS (M12, M13, M14, M15)

1. SSH into your EC2: `ssh -i your-key.pem ec2-user@YOUR-EC2-IP`
2. Run the setup script: `bash setup-ec2.sh`
3. Create **.env.prod** on the EC2 with your RDS endpoint, Groq API key, and AWS credentials
4. From your local machine, run: `bash deploy/deploy.sh`
5. Verify API is running: `curl http://YOUR-EC2-IP:8000/health`
6. Update RDS Security Group to allow inbound on port 5432 from the EC2 Security Group only
7. Build and upload frontend: `bash deploy/deploy-frontend.sh` (enable static website hosting on S3 first)
8. Update frontend **NEXT_PUBLIC_API_URL** to `http://YOUR-EC2-IP:8000` before building
9. Test end-to-end: open the S3 website URL, register, log in, create a unit
10. Set up a cron on EC2 to auto-restart if server reboots: `sudo crontab -e` → add `@reboot cd /home/ec2-user/promptledger && docker-compose up -d`

---

## Complete Manual Tasks Index

| ID  | Task                                                                                  | Phase      | Time              |
|-----|---------------------------------------------------------------------------------------|------------|-------------------|
| M1  | Install Python 3.11, Node 20, Docker Desktop, Git, Ollama on local machine            | Before P1  | 30 min            |
| M2  | Run `ollama pull llama3.1:8b` and `ollama pull phi3:mini` (background)               | Before P2  | 20 min (waiting)  |
| M3  | Sign up at groq.com, get free API key                                                  | Before P1  | 5 min             |
| M4  | Sign up at resend.com, get free API key (for email alerts)                             | Before P1  | 5 min             |
| M5  | Start Docker, run docker-compose.local.yml (starts Postgres + Redis locally)          | P1.2       | 2 min             |
| M6  | Fill in backend/.env with local values + Groq key + generate SECRET_KEY              | P1.2       | 10 min            |
| M7  | Run `alembic upgrade head` to create DB tables                                        | P1.2       | 2 min             |
| M8  | Register GitHub App (for webhook integration) — see Phase 4                           | P4         | 20 min            |
| M9  | End-to-end local test: register → create unit → push version → run eval → check drift| After P3   | 1 hour            |
| M10 | Create AWS free tier account, set billing alarm                                        | P5         | 20 min            |
| M11 | Create EC2 t2.micro, RDS PostgreSQL, S3 bucket, IAM user, SES email verification     | P5         | 45 min            |
| M12 | Create .env.prod on EC2 with RDS endpoint + prod credentials                          | P5         | 10 min            |
| M13 | Run deploy.sh to push backend to EC2, verify API health                               | P5         | 15 min            |
| M14 | Build and upload frontend to S3, enable static website hosting                        | P5         | 15 min            |
| M15 | Publish CLI to PyPI: `python -m build && twine upload dist/*`                         | P5         | 20 min            |

---

## Total Cost Breakdown

### Stage A — Local Development: **$0.00 / month**

Everything runs on your machine. Ollama is free and offline. Postgres + Redis in Docker. Groq API is free (14,400 calls/day). sentence-transformers is a pip package. No accounts needed except Groq + Resend.

### Stage B — AWS Free Tier (12 months): **~$0–2 / month**

EC2 t2.micro + RDS t3.micro + S3 5GB are all free tier. Groq API still free for LLM. SES emails free from EC2. Only cost might be data transfer overage if app goes viral.

| Service          | Local                          | AWS (after free tier)                    |
|------------------|-------------------------------|------------------------------------------|
| LLM (eval judge) | $0 (Ollama / Groq free)       | $0 (Groq free tier)                      |
| Embeddings       | $0 (sentence-transformers)    | $0 (same library on EC2)                 |
| Database         | $0 (Docker Postgres)          | $0 (RDS free 12mo) then ~$15/mo          |
| Redis            | $0 (Docker Redis)             | $0 (on EC2 instance)                     |
| Backend hosting  | $0 (localhost)                | $0 (EC2 free 12mo) then ~$8/mo           |
| Frontend         | $0 (localhost:3000)           | $0 (S3 static site)                      |
| File storage     | $0 (local /tmp)               | $0 (S3 5GB free)                         |
| Email alerts     | $0 (Resend 3k/mo free)        | $0 (SES from EC2)                        |
| **TOTAL**        | **$0**                        | **$0 (for 12 months)**                   |

> 🎯 **After AWS free tier expires (12 months):** If the product is live and getting users, you'll be making money by then. EC2 t2.micro is ~$8/mo, RDS t3.micro is ~$15/mo. Total ~$23/mo — easily covered by even 1 paying user at $199/mo.
>
> If you need to extend free hosting past 12 months with zero revenue: migrate to Oracle Cloud Always Free (2 ARM VMs + 20GB DB, permanently free) or Fly.io free tier.
