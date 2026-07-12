# Smart Support Ticket Router

A context-aware support ticket router. A support agent picks a customer,
types a support message, and the system returns a **category, priority,
assigned team, one-line reasoning, confidence score, and the evidence it used
to decide** — grounded in real customer data and real historical tickets, not
just an LLM's guess.

## Business problem

Support teams triage incoming tickets by hand: read the message, look up the
customer's plan and account status, check if there's a known outage, search
for similar past tickets, then decide category/priority/team. That's slow,
inconsistent between agents, and easy to get wrong under load (e.g. missing
an active outage, or escalating an angry-but-low-severity message).

This project automates the *triage* step — not the resolution — and always
shows the agent **why** it made that call, so a human can override it in one
click when it's wrong.

## Core idea

> We use **SQL** for exact facts, **RAG** for relevant historical knowledge,
> the **LLM** for classification and reasoning, and **backend rules** for
> reliability.

| Need | Tool | Why |
|---|---|---|
| "Is this customer's subscription active? Do they have access?" | **PostgreSQL** | These are exact, structured facts. A vector search or an LLM has no business guessing them — a SQL query gives a guaranteed-correct answer. |
| "Have we seen a ticket like this before, and how was it resolved?" | **pgvector (RAG)** | Similarity between free-text messages isn't a lookup, it's a *fuzzy match* — that's what embeddings + cosine distance are for. |
| "What category/priority/team, in plain language?" | **LLM** (or a rule-based mock) | Turning messy natural language into a structured decision, with a one-line human-readable reason, is exactly what an LLM is good at. |
| "Security issues are always High priority, no matter what the model says" | **Backend Python rules** | LLMs are probabilistic. Safety-critical business rules must hold 100% of the time, so they're enforced in code *after* the model responds, not just requested in the prompt. |

### Why not a Knowledge Graph?

A knowledge graph would model relationships like *Customer → owns →
Product → had → Incident* explicitly as graph edges. For this project's
scale (a handful of entities: customers, products, incidents, tickets) a
relational schema with foreign keys already **is** that graph — `JOIN`s
answer "which incidents affect this customer's products" just as well as a
graph traversal would, with far less operational complexity (no second
database, no separate query language). A knowledge graph would start to earn
its cost at much larger scale (many entity types, deep multi-hop relationship
questions) — not here. This is a deliberate scope decision, not a missing
feature.

## Architecture

```
┌─────────────┐      HTTP       ┌──────────────┐
│   React UI  │ ───────────────▶│   FastAPI    │
│ (Vite + TS) │◀─────────────── │   backend    │
└─────────────┘     JSON        └──────┬───────┘
                                        │
                 ┌──────────────────────┼───────────────────────┐
                 ▼                      ▼                       ▼
         ┌───────────────┐     ┌────────────────┐      ┌─────────────────┐
         │  context_service│    │ retrieval_service│    │ routing_service │
         │  (SQL facts)   │     │ (pgvector RAG)  │     │ (LLM + rules)   │
         └───────┬────────┘     └────────┬───────┘      └────────┬────────┘
                 │                        │                       │
                 └────────────┬───────────┴───────────────────────┘
                              ▼
                     ┌──────────────────┐
                     │ PostgreSQL +      │
                     │ pgvector          │
                     └──────────────────┘
```

**Request flow for `POST /api/tickets/route`:**
1. `context_service` fetches the customer's profile, purchased products/access, and any active incidents matching their products/region — straight SQL, no fuzziness.
2. `retrieval_service` embeds the ticket message and finds the 3–5 most similar **resolved, human-verified** past tickets and up to 3 relevant knowledge documents via pgvector cosine distance.
3. `routing_service` builds a strict prompt from both, calls the LLM (or the mock rule-based classifier), validates the JSON response against a Pydantic schema, and applies backend safety rules (e.g. "security → High priority") that hold regardless of what the model said.
4. The result — plus exactly which customer facts / incidents / tickets / documents were used — is returned and persisted onto the ticket.

## Technology stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy, Alembic
- **Database:** PostgreSQL 16 + pgvector
- **Testing:** Pytest (backend), Vitest + React Testing Library (frontend unit), Playwright (one critical E2E flow)
- **Dev environment:** Docker Compose (Postgres/pgvector only — frontend/backend run natively for fast reload)

## Project structure

```
smart-ticket-router/
├── frontend/            React + TypeScript + Vite + Tailwind workspace UI
│   ├── src/
│   │   ├── components/  TicketQueue, ConversationPanel, Customer360, AIRecommendationCard, ...
│   │   ├── pages/        WorkspacePage, AnalyticsPage
│   │   ├── services/     api.ts — thin fetch wrapper around the backend
│   │   └── types/        TypeScript types mirroring the backend's Pydantic schemas
│   └── e2e/               Playwright critical-path test
├── backend/
│   ├── app/
│   │   ├── api/          FastAPI routers (customers, tickets, incidents, metrics)
│   │   ├── core/          settings (.env), exception handlers
│   │   ├── db/            engine/session, seed data, embedding backfill, demo-ticket runner
│   │   ├── models/        SQLAlchemy models + controlled-vocabulary enums
│   │   ├── schemas/        Pydantic request/response contracts
│   │   └── services/       context_service (SQL), retrieval_service (pgvector), routing_service (LLM + rules)
│   ├── migrations/         Alembic
│   └── tests/              Pytest suite
├── database/               Note on where seed data actually lives (see below)
├── docker-compose.yml      Postgres + pgvector only
├── .env.example
└── README.md
```

## Setup instructions

### Prerequisites
- Docker Desktop (for Postgres/pgvector)
- Python 3.11+ 
- Node.js 20+

### 1. Environment variables

```bash
cp .env.example .env
```

The defaults work with **zero API keys** — both the LLM and the embedding
service default to a mock/demo mode (see [Mock mode limitations](#mock-mode-limitations)
below).

| Variable | Purpose | Default |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | Docker Compose Postgres credentials | `ticket_user` / `ticket_pass` / `ticket_router` / `5432` |
| `DATABASE_URL` | SQLAlchemy connection string | matches the above, `localhost` |
| `MAX_TICKET_MESSAGE_LENGTH` | Max characters accepted for a ticket message | `4000` |
| `LLM_PROVIDER` | `mock` (rule-based, free, offline) or `anthropic` (real Claude calls) | `mock` |
| `ANTHROPIC_API_KEY` | Required only if `LLM_PROVIDER=anthropic` | empty |
| `LLM_MODEL` | Claude model name | `claude-sonnet-5` |
| `EMBEDDING_PROVIDER` | `mock` (hashed bag-of-words, free, offline) or `openai` (real embeddings) | `mock` |
| `OPENAI_API_KEY` | Required only if `EMBEDDING_PROVIDER=openai` | empty |
| `EMBEDDING_DIM` | Vector column dimension (must stay fixed once you've migrated) | `384` |
| `VITE_API_BASE_URL` | Frontend → backend base URL | `http://localhost:8000` |

Never commit your real `.env` — only `.env.example` is tracked (see `.gitignore`).

### 2. Start PostgreSQL + pgvector

```bash
docker compose up -d
```

This starts a single `pgvector/pgvector:pg16` container. No other services
run in Docker — frontend and backend run natively for faster reload.

### 3. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Apply the database schema
alembic upgrade head

# Load demo data (10 customers, 5 products, incidents, 30+ historical
# tickets, 20+ demo tickets, knowledge docs)
python -m app.db.seed

# Compute embeddings for everything the seed script just created
python -m app.db.backfill_embeddings

# Run the API
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for the interactive API docs.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`.

### Re-seeding

`python -m app.db.seed` is safe to re-run — it truncates and reloads all
demo data (and resets id sequences), so if a demo session leaves things messy
just re-seed and re-run the embedding backfill.

## Database migrations

Migrations live in `backend/migrations/` (Alembic). To create a new one after
changing a model:

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

`migrations/env.py` reads `DATABASE_URL` from the same `.env` the app uses,
so migrations always target the database you're actually running against.

## How to run tests

### Backend (Pytest)

```bash
cd backend
source .venv/bin/activate
# requires: docker compose up -d, then seed + backfill (see above)
python -m app.db.seed && python -m app.db.backfill_embeddings
python -m pytest tests/ -v
```

46 tests cover: schema validation across repeated routing calls, angry-tone
non-escalation, the "broken" → Needs Clarification case, high-severity
priority rules, input validation (empty/too-long messages, invalid customer
id), LLM-failure fallback behaviour, routing consistency, and that every
retrieved evidence id corresponds to a real database row.

Tests run against the same seeded dev database (not a separate test DB or
mocks) — this keeps setup simple while still exercising real pgvector/enum/FK
behaviour. Re-seed between test runs if a run leaves the ticket queue in an
unusual state (e.g. after running the demo script).

### Frontend (Vitest + React Testing Library)

```bash
cd frontend
npm run test
```

Covers: loading the ticket queue/customer 360 data, submitting a new ticket,
rendering an AI recommendation, rendering an error/fallback state, and
accepting/editing a recommendation.

### End-to-end (Playwright)

One critical path only — select a ticket, route it, accept the AI
recommendation:

```bash
cd frontend
npm run dev &            # frontend on :5173
cd ../backend && uvicorn app.main:app --port 8000 &   # backend on :8000
cd ../frontend
npm run test:e2e
```

## How to run the 20-ticket demo

The seed script creates 21 unrouted "demo" tickets (status `Open`), each
covering one of the required edge cases (angry customer, vague "broken"
message, ambiguous billing/access, payment-deducted-access-missing, active
regional incident, security concern, refund request, general product
question, Hindi message, repeated unresolved issue, customer without access
to a claimed product, low-priority feature request, and more).

**Option A — see them live in the UI:** open the workspace, click the
"Unassigned" filter, and click "Route Ticket" on each one.

**Option B — run them all from the command line:**

```bash
cd backend
source .venv/bin/activate
python -m app.db.run_demo_tickets
```

This prints a table of category/priority/team/confidence for all 21 tickets
in one pass. `tests/test_demo_tickets.py` runs the same set through the
routing service as part of the automated test suite (without mutating the
ticket rows other tests rely on).

## Example request/response

```
POST /api/tickets/route
{
  "customer_id": 1,
  "message": "My Payments Gateway plan shows active and I was charged, but I still can't access any payment features.",
  "channel": "Email"
}
```

```json
{
  "category": "Billing",
  "priority": "High",
  "assigned_team": "Billing Operations",
  "reasoning": "Message concerns a charge, invoice or subscription state. Standard issue with no high-severity signal detected.",
  "confidence": 0.78,
  "needs_human_review": false,
  "clarification_questions": [],
  "context_used": {
    "customer_profile_used": true,
    "product_ids": [1, 2],
    "active_incident_ids": [1],
    "similar_ticket_ids": [19, 2, 16, 21, 26],
    "knowledge_document_ids": [2, 4, 3]
  },
  "ticket_id": 52
}
```

Note the backend safeguard: even though the mock classifier's own priority
guess was "Medium" for this category, the backend detected an active
subscription with inactive product access (a "payment deducted, access
missing" pattern) and forced priority to **High** — a rule that holds
regardless of what the LLM/mock said.

## Edge-case behaviour

| Input | Behaviour |
|---|---|
| Empty message | `422` with a readable validation error, no ticket created |
| Very short message ("broken") | `category: "Needs Clarification"`, 3 concrete clarification questions, `needs_human_review: true` |
| Angry/emotional message | Tone alone never raises priority — only a genuine signal (security, outage, payment/access mismatch, matching critical incident) does |
| Ambiguous message | Routed to the closer-matching category with **lower confidence**, which itself triggers `needs_human_review: true` below the 0.6 threshold |
| Very long message | Rejected with `422` if it exceeds `MAX_TICKET_MESSAGE_LENGTH` (4000 chars by default) |
| Non-English message (e.g. Hindi) | Still processed — the mock classifier only understands English keywords, so it correctly reports **low confidence** and defers to a human, rather than fabricating a confident wrong answer. A real LLM provider (`LLM_PROVIDER=anthropic`) understands Hindi natively. |
| Invalid customer id | `404` with a clean error message |
| LLM API failure | One controlled retry, then a safe fallback (`General Support`, `needs_human_review: true`) — never a crash or a raw provider error |
| Embedding API failure | Falls back to the mock embedding for that request; routing still completes |
| Database failure | Caught by a global exception handler → `500` with a generic message; no stack trace or secret ever reaches the frontend |

## Failure handling (routing service)

1. Validate the model's JSON output against a strict Pydantic schema.
2. If invalid, retry once (`LLM_MAX_ATTEMPTS = 2` in `routing_service.py`).
3. If it still fails, return the safe fallback: category `Other`, team
   `General Support`, `needs_human_review: true`, confidence `0.0`.
4. Network/API errors are caught the same way as malformed JSON — they never
   propagate as a 500 to the agent.
5. Raw provider errors and API keys are never logged or returned to the client.

## Consistency

The same input against the same stored context produces the same category,
priority and team — enforced by a strict output schema, controlled enums, a
deterministic mock classifier (and `temperature=0` for the real LLM path),
backend safety rules that don't depend on model phrasing, and stable context
ordering. Reasoning text may vary slightly with a real LLM; the structured
decision does not.

## Manual vs AI routing time

The Analytics page (`/` → "Analytics" tab) shows:
- **Avg. AI routing time** — *measured*, from real routing calls made during
  the current server session (stored on `tickets.routing_time_ms`).
- **Estimated manual routing time** — a labelled *estimate* (240 seconds —
  read message, check account, decide category/priority/team), not a
  measurement. See `ESTIMATED_MANUAL_ROUTING_SECONDS` in
  `app/services/metrics_service.py`.
- **Estimated time saved** — the difference between the two, only shown once
  at least one ticket has been routed this session.

## Mock mode limitations

**Mock LLM** (`LLM_PROVIDER=mock`, the default): a deterministic keyword
classifier, not a language model. It matches English phrases like "refund",
"charged", "log in", "complete outage" — it does not understand meaning,
sarcasm, or non-English text. This is intentional: it lets the whole app run
free and offline, and makes routing behaviour trivially reproducible in
tests. Set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` for real
classification.

**Mock embeddings** (`EMBEDDING_PROVIDER=mock`, the default): a hashed
bag-of-words vector (tokens hashed into fixed positions, counted, then
normalized). It captures literal word overlap, **not** real semantic
similarity — "my dashboard won't open" and "the UI is unresponsive" would
NOT be scored as similar, even though a human immediately sees they're the
same issue. This is clearly a demo approximation, not real semantic search.
Set `EMBEDDING_PROVIDER=openai` and `OPENAI_API_KEY` for real embeddings
(requested at `EMBEDDING_DIM` dimensions so the pgvector column size stays
fixed regardless of provider).

## Current limitations

- Mock LLM/embedding modes (above) are keyword/lexical, not semantic — real
  API keys unlock real understanding.
- `context_used` evidence ids are only kept in the browser's memory for the
  current session; reload the page and an already-routed ticket shows its
  decision but not the original evidence ids (the UI clearly labels this).
- "Public Reply" / "Internal Note" tabs are visual placeholders — this
  project routes tickets, it isn't a full messaging platform.
- No authentication — this is a single-workspace demo, not a multi-tenant
  production system.

## Future improvements (kept short)

- Persist `context_used` onto the ticket so evidence survives a reload.
- Swap the mock classifier/embeddings for real providers by default once API
  budget allows.
- Paginate the ticket queue for datasets much larger than the demo seed.

## Mentor demo checklist

- [ ] `docker compose up -d` — Postgres + pgvector healthy
- [ ] `alembic upgrade head` — schema applied
- [ ] `python -m app.db.seed && python -m app.db.backfill_embeddings` — demo data loaded
- [ ] `uvicorn app.main:app --port 8000` — backend running, `/health` returns `{"status": "ok"}`
- [ ] `npm run dev` (frontend) — workspace loads at `localhost:5173`
- [ ] Click a ticket in "Unassigned" → "Route Ticket" → AI Recommendation card appears with evidence
- [ ] Click "Route Without vs With Context" → see the two results differ
- [ ] Click "Accept Routing" → ticket status updates, feedback row created
- [ ] Open the "AI Evidence" tab in Customer 360 → real ids shown
- [ ] Type "broken" into a new ticket → get "Needs Clarification" with 3 questions
- [ ] Type an angry-but-low-severity message → priority stays Medium/Low, not High
- [ ] Visit the Analytics tab → measured vs estimated routing time both visible
- [ ] `python -m pytest tests/ -v` in `backend/` → 46 tests pass
- [ ] `npm run test` in `frontend/` → unit tests pass
