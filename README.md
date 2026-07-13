# Smart Support Ticket Router

A context-aware support ticket router: customers submit tickets, AI suggests
how to route them (category, priority, team, and *why*), and human agents
review, adjust, and resolve them.

## The business problem

Support teams normally triage tickets by hand: read the message, check the
customer's plan and account status, look for a known outage, search for
similar past tickets, then decide category/priority/team. That's slow,
inconsistent between agents, and easy to get wrong under load.

## What this app does

It automates the **triage** step — not the resolution. It reads a ticket,
gathers real facts about the customer (plan, active incidents, similar past
tickets), asks an AI model to classify it, double-checks that classification
against fixed backend safety rules, and hands the agent a recommendation with
its reasoning and evidence attached. The agent always makes the final call.

**This system does not resolve tickets automatically.** It routes and
triages; a human support agent reviews every AI recommendation and can
accept, correct, or reassign it before anything is considered done.

## How a ticket flows

```
Customer submits ticket
      │
      ▼
Backend gathers context (customer profile, products, active incidents,
similar resolved tickets, knowledge docs)
      │
      ▼
OpenAI (or a mock classifier) suggests category / priority / team
      │
      ▼
Backend safety rules double-check the suggestion
(e.g. "security issues are always High priority", regardless of what the
model said)
      │
      ▼
Support agent reviews the recommendation → accepts, edits, assigns, or
asks for clarification
```

## Main features

- Customers can sign up, submit tickets, and track their status.
- AI suggests a category, priority, assigned team, and a one-line reason for
  every ticket — plus exactly which customer facts, incidents, and past
  tickets it used.
- Backend rules catch cases the AI might get wrong (e.g. an angry tone alone
  should not raise priority; a real security report always should).
- Agents can accept, correct, assign, reply to, and resolve tickets, and
  leave internal notes customers never see.
- Admins can invite/manage agents and view an audit log.
- A simple analytics view compares measured AI routing time against an
  estimated manual routing time.

## User roles

| Role | Can do |
|---|---|
| **Customer** | Sign up, submit tickets, view/reply to their own tickets, reopen a resolved one |
| **Support Agent** | View all tickets, route/accept/correct/assign/resolve, add internal notes |
| **Admin** | Everything an agent can, plus invite/manage agents and view the audit log |

## Technology

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy, Alembic
- **Database:** PostgreSQL + pgvector (for similarity search)
- **AI:** OpenAI (or Anthropic) for classification and embeddings — with a
  free, offline mock mode for both
- **Testing:** Pytest (backend), Vitest (frontend unit), Playwright (E2E)

See [docs/TECHNICAL_GUIDE.md](docs/TECHNICAL_GUIDE.md) for the full
architecture and code-level detail.

## Prerequisites

- Docker Desktop
- Python 3.11+
- Node.js 20+

## Local setup

### 1. Environment variables

```bash
cp .env.example .env
```

The defaults work with **zero API keys** (both AI and embeddings default to
an offline mock mode). To use real AI classification, open `.env` and set:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=your-real-key-here
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

alembic upgrade head                  # create the database schema
python -m app.db.seed                 # load demo customers, products, tickets
python -m app.db.backfill_embeddings  # compute embeddings for the seed data
python -m app.db.seed_auth            # create the three demo login accounts

uvicorn app.main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

## URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs

## Demo accounts

`python -m app.db.seed_auth` creates three local-dev-only accounts, all with
password `DemoPass123!`:

| Email | Role |
|---|---|
| `customer@example.com` | Customer |
| `agent@example.com` | Support Agent |
| `admin@example.com` | Admin |

Never reuse this password outside local development.

## Running tests

```bash
# Backend
cd backend && source .venv/bin/activate
python -m pytest tests/ -v

# Frontend
cd frontend && npm run test

# End-to-end (requires both servers running)
cd frontend && npm run test:e2e
```

## A short demo flow

1. Log in as `customer@example.com` → submit a new ticket → watch it update
   with a category/priority once AI routing finishes.
2. Log in as `agent@example.com` → open the ticket → see the AI
   recommendation with its reasoning and evidence → accept or correct it.
3. Add a public reply and an internal note, then assign the ticket to
   another agent.
4. Log back in as the customer → confirm you see the reply but not the
   internal note.
5. Log in as `admin@example.com` → invite a new agent and view the audit log.

## More documentation

- [docs/TECHNICAL_GUIDE.md](docs/TECHNICAL_GUIDE.md) — architecture, code
  flow, database schema, security model, API reference.
- [docs/EXPERIMENTAL_PERFORMANCE.md](docs/EXPERIMENTAL_PERFORMANCE.md) —
  what's actually been measured vs. estimated vs. mocked.

## Known limitations

- The default mock AI/embedding modes are keyword-based, not semantic — real
  API keys unlock real understanding.
- Rate limiting and sessions are in-memory (fine for local dev, not a
  multi-instance production deployment).
- No real email provider — reset/invite links are logged, not emailed.
- No pagination on ticket lists yet.
- No 2FA or social login.
