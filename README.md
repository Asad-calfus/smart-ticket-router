# Smart Support Ticket Router

A context-aware, multi-user support ticket router. Customers sign up, submit
tickets, and track them. Support agents route tickets with AI assistance and
respond. Admins manage the team. Every routing decision returns a
**category, priority, assigned team, one-line reasoning, confidence score,
and the evidence it used to decide** — grounded in real customer data and
real historical tickets, not just an LLM's guess.

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

## Authentication architecture

**Sessions, not JWTs.** Login creates an opaque, cryptographically random
session token (`secrets.token_urlsafe(32)`); only its SHA-256 hash is stored
(`user_sessions` table). The raw token lives in an **HttpOnly** cookie —
never in localStorage, never readable by JavaScript. This makes sessions
trivially revocable (delete the row) and immune to XSS token theft, at the
cost of a DB lookup per request (fine at this scale).

- **Sliding expiry**: every authenticated request pushes `expires_at` out
  another `SESSION_LIFETIME_HOURS` (12h default) — this is the "session
  renewal" mechanism. No separate refresh endpoint needed.
- **CSRF protection**: a second, **non**-HttpOnly `csrf_token` cookie is set
  alongside the session cookie. The frontend reads it and echoes it back as
  an `X-CSRF-Token` header on every state-changing request (POST/PATCH/DELETE);
  the backend rejects the request if the header doesn't match the cookie
  (`app/api/deps.py::get_current_user`). This is the standard "double-submit
  cookie" pattern — GET requests are exempt (they're not state-changing).
- **Password hashing**: Argon2 (`argon2-cffi`), the modern default.
- **Reset / verification / invitation tokens**: same pattern as sessions — a
  random raw token is sent to the user (logged, see below), only its hash is
  stored, each has an `expires_at` and a `used_at` that's set the moment it's
  consumed (one-time use). A password reset also invalidates every existing
  session for that user.
- **Generic errors**: login, forgot-password, and reset-password all return
  identical messages whether or not the email/token is valid — never
  "no account with that email" vs "wrong password".
- **Rate limiting**: a small in-memory sliding-window limiter on
  `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`
  (`app/core/rate_limit.py`). This is real protection against basic
  brute-forcing, but it's per-process memory, not distributed — a
  multi-worker/multi-instance production deployment would need a shared
  store (e.g. Redis). Documented here rather than overstated.
- **Dev-only email**: there's no real email provider configured. Password
  reset links, email verification links, and agent invitation links are
  **logged** (`app/core/dev_email.py`), clearly prefixed `[DEV EMAIL]` —
  never returned in an API response body, even in this demo.
- **Mass-assignment protection**: request schemas only ever contain
  explicitly-writable fields (e.g. `MyProfileUpdate` has no `tier` or
  `customer_id` field at all) — extra keys in a request body are silently
  ignored by Pydantic, never mapped onto the ORM model.
- **Ownership derived server-side, never trusted from the client**: e.g.
  `POST /api/my/tickets` derives `customer_id` from the logged-in user's
  linked `CustomerProfile` — a customer can never act on another customer's
  data by passing a different id.

## Role/permission matrix

| Action | Customer | Support Agent | Admin |
|---|:---:|:---:|:---:|
| Sign up (public) | ✅ | ❌ (invited only) | ❌ (invited only) |
| View/edit own profile | ✅ | — | — |
| Create a ticket for themselves | ✅ | — | — |
| View their own tickets | ✅ | ❌ | ❌ |
| View *any* ticket / the routing workspace | ❌ | ✅ | ✅ |
| Reply to their own ticket / reopen if resolved | ✅ | — | — |
| Route / accept / edit / resolve a ticket | ❌ | ✅ | ✅ |
| Add an internal note | ❌ | ✅ | ✅ |
| See AI evidence / routing analytics | ❌ | ✅ | ✅ |
| Assign a ticket to an agent | ❌ | ✅ | ✅ |
| Invite / activate / deactivate agents | ❌ | ❌ | ✅ |
| Change a user's role/team | ❌ | ❌ | ✅ |
| View the audit log | ❌ | ❌ | ✅ |

Every row is enforced in the FastAPI backend via `app/api/deps.py`
(`require_customer` / `require_agent` / `require_admin`) — the frontend
hides buttons a role can't use, but that's a UX nicety, not the security
boundary. See `tests/test_authorization.py` for the tests that verify this
table holds (cross-customer isolation, role boundaries, internal
notes/evidence never reaching customer responses).

## Technology stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router
- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy, Alembic, Argon2 (`argon2-cffi`)
- **Database:** PostgreSQL 16 + pgvector
- **Testing:** Pytest (backend), Vitest + React Testing Library (frontend unit), Playwright (E2E)
- **Dev environment:** Docker Compose (Postgres/pgvector only — frontend/backend run natively for fast reload)

## Project structure

```
smart-ticket-router/
├── frontend/            React + TypeScript + Vite + Tailwind + React Router
│   ├── src/
│   │   ├── components/  TicketQueue, ConversationPanel, Customer360, AIRecommendationCard,
│   │   │                ProtectedRoute, AgentLayout/CustomerLayout/AdminLayout, ...
│   │   ├── contexts/     AuthContext — current user, login/signup/logout, session restore
│   │   ├── pages/
│   │   │   ├── auth/      Login, Signup, ForgotPassword, ResetPassword, VerifyEmail, AcceptInvitation
│   │   │   ├── customer/  Profile, NewTicket, MyTickets, TicketConversation
│   │   │   ├── admin/     Agents (invite/list/activate), AuditLog
│   │   │   ├── WorkspacePage.tsx   agent/admin routing workspace
│   │   │   └── AnalyticsPage.tsx
│   │   ├── services/     api.ts — fetch wrapper (credentials + CSRF header handling)
│   │   └── types/        TypeScript types mirroring the backend's Pydantic schemas
│   └── e2e/               Playwright: routing critical-path + full auth/RBAC flow
├── backend/
│   ├── app/
│   │   ├── api/           auth, customer_portal, admin, customers, tickets, incidents, metrics, deps.py
│   │   ├── core/           settings (.env), security.py (hashing/tokens/cookies), rate_limit.py,
│   │   │                   dev_email.py, exception handlers
│   │   ├── db/             engine/session, seed data, seed_auth (demo accounts), embedding backfill,
│   │   │                   demo-ticket runner
│   │   ├── models/         SQLAlchemy models + controlled-vocabulary enums (incl. User, CustomerProfile,
│   │   │                   AgentProfile, AgentInvitation, AuthToken, UserSession, TicketMessage,
│   │   │                   TicketAssignment, AuditEvent, RoutingEvidence)
│   │   ├── schemas/        Pydantic request/response contracts
│   │   └── services/       auth_service, audit_service, conversation_service, admin_service,
│   │                       customer_portal_service, context_service (SQL), retrieval_service (pgvector),
│   │                       routing_service (LLM + rules)
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
| `COOKIE_SECURE` | `true` in production (HTTPS only); `false` for local `http://localhost` | `false` |
| `SESSION_LIFETIME_HOURS` | Sliding session expiry | `12` |
| `PASSWORD_RESET_TOKEN_LIFETIME_MINUTES` | Reset link validity | `30` |
| `EMAIL_VERIFICATION_TOKEN_LIFETIME_HOURS` | Verify-email link validity | `24` |
| `AGENT_INVITATION_LIFETIME_DAYS` | Agent invite link validity | `7` |
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

# Create/repair the three demo login accounts (see "Demo accounts" below)
python -m app.db.seed_auth

# Run the API
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for the interactive API docs.

### Demo accounts

`python -m app.db.seed_auth` creates three **local-development-only** accounts,
all with password `DemoPass123!`:

| Email | Role | Notes |
|---|---|---|
| `customer@example.com` | Customer | Linked to the seeded "Ananya Sharma" business customer — has real historical tickets, products, and an active incident to explore |
| `agent@example.com` | Support Agent | General Support team |
| `admin@example.com` | Admin | Can invite/manage agents, view the audit log |

These are **not real credentials** — never reuse this password outside local
development, and never seed these accounts against a production database.
The script is additive and safe to re-run (see "Re-seeding" below).

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`.

### Re-seeding

`python -m app.db.seed` is safe to re-run — it truncates and reloads all
demo data (and resets id sequences). Because `customer_profiles` has a
foreign key to `customers`, that truncation also empties `customer_profiles`
— so **always run `python -m app.db.seed_auth` again immediately after**
re-seeding to restore the demo login accounts (it re-links by email, not by
numeric id, so it never creates duplicate users or leaves orphaned links).
Then re-run the embedding backfill.

```bash
python -m app.db.seed && python -m app.db.backfill_embeddings && python -m app.db.seed_auth
```

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

**Note on enum values**: adding a value to an existing Postgres enum (e.g.
`TicketStatus.REOPENED`) can't be autogenerated — Postgres requires
`ALTER TYPE ... ADD VALUE` to run outside the migration's normal transaction.
See `migrations/versions/98c77cc29104_*.py` for the pattern
(`op.get_context().autocommit_block()`).

Verified on both a fresh database (`docker run` a brand-new
`pgvector/pgvector:pg16` container, `alembic upgrade head` from empty) and
against this project's existing seeded database — all four migrations apply
cleanly in both cases with no manual intervention.

## How to run tests

### Backend (Pytest)

```bash
cd backend
source .venv/bin/activate
# requires: docker compose up -d, then seed + backfill + seed_auth (see above)
python -m app.db.seed && python -m app.db.backfill_embeddings && python -m app.db.seed_auth
python -m pytest tests/ -v
```

**81 tests** across:
- `test_routing.py` / `test_retrieval.py` / `test_demo_tickets.py` / `test_db_models.py` — the original
  AI-routing suite (schema validation across repeated routing calls, angry-tone non-escalation, "broken" →
  Needs Clarification, high-severity priority rules, input validation, LLM-failure fallback, consistency,
  evidence-ids-are-real) — all still pass unchanged, now running as an authenticated agent.
- `test_api.py` — agent-facing endpoints, now behind auth.
- `test_auth.py` — signup/login/logout/me, incorrect credentials, disabled/unverified users, password reset
  expiry + one-time use, session invalidation on reset, change-password.
- `test_authorization.py` — cross-customer isolation (404 not 403), role boundaries (customer/agent/admin),
  admin agent management, **internal notes and AI evidence never reaching customer responses**, ticket
  assignment, reopen/status-transition conflicts.
- `test_customer_portal.py` — profile mass-assignment protection, ticket creation/ownership.

Tests run against the same seeded dev database (not a separate test DB or
mocks) — this keeps setup simple while still exercising real pgvector/enum/FK
behaviour. Re-seed (all three commands above) between test runs if a run
leaves the ticket queue or demo accounts in an unusual state (e.g. after
running the demo script, or after tests that route/resolve/reassign tickets).

### Frontend (Vitest + React Testing Library)

```bash
cd frontend
npm run test
```

**30 tests** covering: loading the ticket queue/customer 360 data, submitting
a new ticket, rendering an AI recommendation, rendering an error/fallback
state, accepting/editing a recommendation, login/signup (success + generic
error messages), `ProtectedRoute` (loading/redirect/role-gating/authorized
render), the customer ticket portal (loading/empty/error states), and the
admin invitation screen (list/invite/deactivate).

### End-to-end (Playwright)

Two flows:

```bash
cd frontend
npm run dev &            # frontend on :5173
cd ../backend && uvicorn app.main:app --port 8000 &   # backend on :8000
cd ../frontend
npm run test:e2e
```

1. **`critical-flow.spec.ts`** — agent logs in, routes an unassigned ticket, accepts the AI recommendation.
2. **`auth-flow.spec.ts`** — the required security-critical path: customer signs in and creates a ticket →
   agent signs in, routes it, adds a public reply *and* an internal note → customer signs back in and sees
   the public reply, but the internal note and AI evidence are absent (they have no UI on the customer side
   at all, and are asserted to have zero DOM occurrences).

## How to run the 20-ticket demo

The seed script creates 21 unrouted "demo" tickets (status `Open`), each
covering one of the required edge cases (angry customer, vague "broken"
message, ambiguous billing/access, payment-deducted-access-missing, active
regional incident, security concern, refund request, general product
question, Hindi message, repeated unresolved issue, customer without access
to a claimed product, low-priority feature request, and more).

**Option A — see them live in the UI:** log in as `agent@example.com`
(password `DemoPass123!`), click the "Unassigned" filter, and click "Route
Ticket" on each one.

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

## API documentation

Full interactive docs (request/response schemas, try-it-out) are at
`http://localhost:8000/docs` once the backend is running. Summary:

**Auth** (`app/api/auth.py`) — all public except `/me` and `/change-password`:
`POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`,
`GET /api/auth/me`, `POST /api/auth/forgot-password`,
`POST /api/auth/reset-password`, `POST /api/auth/verify-email`,
`POST /api/auth/change-password`, `POST /api/auth/accept-invitation`.

**Customer portal** (`app/api/customer_portal.py`, `require_customer`):
`GET`/`PATCH /api/profile`, `POST`/`GET /api/my/tickets`,
`GET /api/my/tickets/{id}`, `GET`/`POST /api/my/tickets/{id}/messages`,
`POST /api/my/tickets/{id}/reopen`.

**Agent/admin ticket workspace** (`app/api/tickets.py`, `require_agent`):
`GET /api/tickets`, `POST /api/tickets/route`, `GET /api/tickets/{id}`,
`POST /api/tickets/{id}/feedback`, `POST /api/tickets/{id}/resolve`,
`GET`/`POST /api/tickets/{id}/messages`, `GET /api/tickets/agents/roster`,
`POST /api/tickets/{id}/assign`, `GET /api/tickets/{id}/evidence`.
Plus `GET /api/customers`, `GET /api/customers/{id}`,
`GET /api/customers/{id}/tickets`, `GET /api/incidents/active`,
`GET /api/metrics/summary` (all `require_agent`).

**Admin** (`app/api/admin.py`, `require_admin`): `POST /api/admin/agents/invite`,
`GET /api/admin/agents`, `POST /api/admin/agents/{id}/activate`,
`POST /api/admin/agents/{id}/deactivate`, `PATCH /api/admin/agents/{id}`,
`GET /api/admin/audit-log`.

All error responses use `{"detail": "..."}`. Status codes: `401` (not
authenticated), `403` (authenticated but wrong role, or a customer trying an
agent/admin-only action), `404` (not found, *or* a real resource the caller
isn't allowed to know exists — see below), `409` (valid request that
conflicts with current state, e.g. reopening a non-resolved ticket), `422`
(request validation failure).

**A note on 404 vs 403**: when a customer requests another customer's ticket,
the API returns `404`, not `403` — a `403` would confirm the ticket id
exists at all, which is itself a (small) information leak. Anywhere
ownership is being checked, "not yours" and "doesn't exist" look identical
from the outside.

## Security assumptions

Documented explicitly rather than assumed:

- **Rate limiting is per-process, in-memory** (`app/core/rate_limit.py`).
  Real protection against naive brute-forcing locally, but a
  multi-worker/multi-instance deployment needs a shared store (Redis) — this
  app doesn't have one, and doesn't pretend to.
- **No real email provider.** Reset/verification/invitation links are logged
  server-side only (`app/core/dev_email.py`), never returned in an API
  response. In production this needs a real transactional email service.
- **`COOKIE_SECURE=false` by default** (for local `http://localhost`). Must
  be `true` in any deployment served over HTTPS, or session/CSRF cookies
  will be sent over plaintext.
- **CORS is locked to a single explicit origin** (`CORS_ORIGINS`, default
  `http://localhost:5173`) — required for cookie-based auth to work at all
  (`allow_credentials=True` cannot be combined with a wildcard origin).
- **Sessions are server-side and revocable**, not JWTs — no token
  blocklist needed, but every authenticated request costs one extra DB
  lookup (`user_sessions`). Fine at this scale; would want caching at
  much higher request volume.
- **No email deliverability, spam, or abuse protections** beyond the rate
  limiter above — this is a portfolio-scale auth system, not a hardened
  production identity provider.

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
- Rate limiting and session storage are in-memory/single-process (see
  "Security assumptions") — fine for local dev and a demo deployment, not a
  multi-instance production one.
- No real email provider — reset/verification/invitation links are logged,
  not emailed (clearly marked dev-only; see "Security assumptions").
- No email-change flow, no 2FA, no OAuth/social login — email+password only.
- Agent "skills" field exists on `AgentProfile` but isn't surfaced in the UI
  yet (no skill-based routing).
- The customer portal's ticket list has no pagination — fine at demo scale.

## Future improvements (kept short)

- A real transactional email provider behind `app/core/dev_email.py`'s interface.
- A shared (Redis-backed) rate limiter for multi-instance deployments.
- Surface `AgentProfile.skills`/`availability_status` in the assignment UI.
- Paginate the ticket queue and customer ticket list for datasets much larger than the demo seed.

## Mentor demo checklist

- [ ] `docker compose up -d` — Postgres + pgvector healthy
- [ ] `alembic upgrade head` — schema applied (18 tables)
- [ ] `python -m app.db.seed && python -m app.db.backfill_embeddings && python -m app.db.seed_auth` — demo data + accounts loaded
- [ ] `uvicorn app.main:app --port 8000` — backend running, `/health` returns `{"status": "ok"}`
- [ ] `npm run dev` (frontend) — loads at `localhost:5173`, redirects to `/login`
- [ ] Sign up a brand-new customer account → lands in "My Tickets" (empty state)
- [ ] Log in as `customer@example.com` → submit a new ticket → see it instantly routed
- [ ] Log in as `agent@example.com` → open the ticket → "Route Ticket" → AI Recommendation card with evidence
- [ ] Click "Route Without vs With Context" → see the two results differ
- [ ] Add a Public Reply and an Internal Note to a ticket
- [ ] Assign the ticket to another agent from the roster dropdown
- [ ] Log back in as the customer → see the public reply, confirm no internal note or AI evidence is visible anywhere
- [ ] Log in as `admin@example.com` → Admin tab → invite a new agent, deactivate/reactivate one, view the audit log
- [ ] Try `agent@example.com` on `/api/admin/agents` (e.g. via `/docs`) → `403`
- [ ] Try a customer on someone else's `/api/my/tickets/{id}` → `404`
- [ ] Type "broken" into a new ticket → get "Needs Clarification" with 3 questions
- [ ] Type an angry-but-low-severity message → priority stays Medium/Low, not High
- [ ] Visit the Analytics tab (as agent/admin) → measured vs estimated routing time both visible
- [ ] `python -m pytest tests/ -v` in `backend/` → 81 tests pass
- [ ] `npm run test` in `frontend/` → 30 tests pass
- [ ] `npm run test:e2e` in `frontend/` → both Playwright flows pass
