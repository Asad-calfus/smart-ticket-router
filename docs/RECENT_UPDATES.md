# Recent updates — what changed and why

A plain-language walkthrough of the three things added to this project
recently: cheaper AI calls, personal LLM settings per agent, and running the
whole app in Docker. For deep technical detail see
[TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md); for the token numbers specifically
see [token-optimization.md](token-optimization.md).

## 1. Making the AI cheaper to run

Every ticket the app routes involves sending text to an AI model and getting
an answer back. Both directions cost "tokens" (small chunks of text), and
tokens cost real money.

**What was wrong:** the AI model in use (`gpt-5-mini`) does invisible
"extra thinking" before answering by default. For this app, that extra
thinking was **79% of every response** — pure waste, since sorting a ticket
into one of 6 categories doesn't need deep reasoning.

**What changed:**
- Told the AI to skip that extra thinking (a setting called
  `reasoning_effort`). Result: **~41% fewer tokens per request, same quality
  answers** — verified with real test calls before and after.
- Added a hard cap on how long a single response can get, so a request can
  never silently balloon in cost.
- The app now **records the real token count for every ticket routed** (you
  can see it on a ticket's "AI Evidence" — `input_tokens`/`output_tokens`
  are now saved), instead of that information being thrown away like before.

**Where:** `backend/app/services/routing_service.py`.

## 2. Every agent can pick their own AI + bring their own key

**Before:** one AI provider and one API key for the whole app, set in a
single config file. Everyone shared it.Token optimization: measurements and changes
Every ticket routing decision goes through one prompt, built once in build_prompt() (backend/app/services/routing_service.py), and sent to whichever provider LLM_PROVIDER (global) or a user's personal LLM settings (UserLLMSettings) selects. This doc records what a request actually costs, what changed as a result, and what's still on the table.

How this was measured
Reconstructed real build_prompt() output using realistic seed-shaped data (backend/app/db/seed.py's customer/products/incident/similar-tickets/ knowledge-docs), counted offline with tiktoken (o200k_base) — zero API cost.
Cross-checked with 3 real, tightly-capped gpt-5-mini calls (mini model, response_format=json_object) to get ground-truth usage numbers, including the real output-token count tiktoken can't predict.
No ongoing cost is required to reproduce this — steps 1 is free, step 2 only matters if you want to re-verify a provider's actual behavior changed.

What a request costs today (input side)
Scenario	Input tokens
Full context, long ticket message (2 products, 1 incident, 5 similar tickets, 3 knowledge docs)	1,377
Full context, short message	1,122
No context (use_context=False), short message	575
Vague message, no context	551
Static boilerplate repeated on every single request, regardless of provider or ticket content: ROLE + ALLOWED VALUES + BUSINESS RULES (≈241 tokens) + STRICT OUTPUT INSTRUCTIONS (≈177 tokens) ≈ 418 tokens/request.

The big finding: hidden reasoning tokens
gpt-5-mini is a reasoning model. Left at its default reasoning effort, most of its "output" tokens are invisible reasoning the app never uses — this task is a 6-way classification, not something that benefits from extended reasoning:

Call	Input	Output	of which reasoning	Total
Default (gpt-5-mini, no override)	575	650	512 (79%)	1,225
Same prompt, reasoning_effort="minimal"	575	147	0	722
−41% total tokens, −77% output tokens, identical output quality (both produced valid, schema-conformant JSON with a sensible reasoning sentence). Confirmed again live in production code after shipping the change — see "Verified live" below.

Changes shipped
All in backend/app/services/routing_service.py:

reasoning_effort="minimal" on OpenAI/Groq calls — added to _call_openai_llm/_call_groq_llm. Not every model accepts this parameter (e.g. the gpt-4o family rejects it with a 400), so both functions try with it first and transparently retry without it on BadRequestError. Since a personal UserLLMSettings row can name any model string, this fallback matters more than it would for a fixed model.
max_completion_tokens=1000 cap on OpenAI/Groq calls — previously uncapped (Anthropic already had max_tokens=600). Bounds worst-case cost/latency and avoids a runaway response that gets cut off mid-JSON, which previously would've just burned a wasted retry.
Real usage capture — every call now returns actual input_tokens/ output_tokens/total_tokens from the provider's own usage object (previously read and discarded). Persisted on RoutingEvidence (migration 4c8ed12c78d0) and exposed via GET /api/tickets/{id}/evidence — token cost per ticket is now an always-on metric, not something you have to measure by hand.
Verified live
Routed a real ticket end-to-end through a personal OpenAI key (see docs/token-optimization.md's companion feature, per-agent LLM settings): input_tokens=1074, output_tokens=165, total_tokens=1239 — output tokens land in the same much-lower range the reasoning_effort="minimal" test predicted, confirming the optimization holds in the real request path, not just in an isolated script.

Considered, not shipped (yet)
Explicit prompt caching (Anthropic cache_control breakpoints) — the static ROLE/RULES/OUTPUT block is already a stable, byte-identical prefix, so it's positioned to benefit, but adding explicit cache-control breakpoints is a code-path addition that isn't worth it at this app's traffic volume. Revisit if request volume grows enough for it to matter. OpenAI's automatic prefix caching (free, no code change, kicks in for prompts ≥1024 tokens with an identical prefix) already applies for free on the larger prompt scenarios above with zero code change.
Trimming RAG evidence text (_format_similar_tickets/ _format_knowledge_documents currently include full, untruncated message/resolution/content fields) — a real token saving, but also a recall/quality tradeoff that needs an eval, not just a token count. Left alone; worth a follow-up if evidence formatting turns out to dominate prompt size at scale.
Reducing top-k retrieval (5 similar tickets / 3 knowledge docs) — same reasoning as above, a quality tradeoff rather than a free optimization.

**Now:** each Support Agent/Admin has a **"LLM Settings" page** (in the top
nav) where they can:
- Choose a provider — Mock (free), Anthropic, OpenAI, or Groq
- Paste in their own API key

That key is **encrypted before it's saved to the database** — think of it
like a locked safe. Nobody, including the settings page itself, can ever see
the full key again after saving; only the last 4 characters are shown
("...ending in 1234") so you can confirm it's there.

If an agent never touches this page, ticket routing just uses the app's
normal shared settings like before — nothing changes for them.

**Where:**
- `backend/app/models/user_llm_settings.py` — the database table
- `backend/app/core/crypto.py` — the encrypt/decrypt logic
- `backend/app/api/llm_settings.py` — the API endpoints
- `frontend/src/pages/LlmSettingsPage.tsx` — the page itself

## 3. The whole app now runs in Docker

This is the part you asked to have explained in more detail — here it is.

### What problem this solves

Before, to run this project you needed all of this installed on your own
machine, exactly right:
- Python (a specific version) + a virtual environment + all its packages
- Node.js + all its packages
- PostgreSQL, with the pgvector extension specifically

If any of those were missing, the wrong version, or misconfigured, the app
wouldn't run — and that's a different setup process on every machine.

**Docker fixes this by packaging each part of the app into a "container"** —
picture a sealed shipping container that already has everything it needs
inside (the right Python version, the right packages, the right database
engine). You don't install anything yourself; Docker builds and runs these
sealed boxes for you, and they behave identically on any machine.

### The three containers

```
                    ┌─────────────────────────────────────────┐
   your browser --> │  frontend  (nginx)                       │
   localhost:8080   │  - serves the built website               │
                     │  - forwards anything starting with /api  │
                     │    to the backend container              │
                     └───────────────┬───────────────────────────┘
                                     │
                     ┌───────────────▼───────────────────────────┐
                     │  backend  (Python + FastAPI)                │
                     │  - the actual application logic             │
                     │  - talks to the database                    │
                     └───────────────┬───────────────────────────┘
                                     │
                     ┌───────────────▼───────────────────────────┐
                     │  db  (PostgreSQL + pgvector)                 │
                     │  - stores customers, tickets, users, etc.    │
                     └───────────────────────────────────────────┘
```

`docker-compose.yml` at the project root is the "recipe" that describes all
three containers and how they connect. Running `docker compose up -d --build`
reads that file and:
1. Builds the `backend` image (installs Python + all packages inside it)
2. Builds the `frontend` image (installs Node, builds the website into
   static files, then hands those files to a small web server called nginx)
3. Starts the database container
4. Starts backend and frontend, wired together on a private internal network

### The new files, and what each one does

- **`backend/Dockerfile`** — step-by-step instructions for building the
  backend container: install Python packages, copy the code in, and on
  startup run the database migrations (`alembic upgrade head`, which brings
  the database schema up to date automatically) before starting the server.
- **`frontend/Dockerfile`** — builds the website in two stages: first a
  temporary Node container compiles the React code into plain HTML/CSS/JS
  files, then those files get handed to a lightweight nginx container that
  actually serves them. The temporary build stage is thrown away — only the
  small nginx image remains.
- **`frontend/nginx.conf`** — tells nginx two things: serve the website
  files, and forward any web address starting with `/api/` straight to the
  backend container instead. This is a nice trick: your browser only ever
  talks to one address (`localhost:8080`), so there's no cross-website
  security friction (called CORS) to configure — nginx quietly bridges the
  two behind the scenes.
- **`docker-compose.yml`** — the recipe tying all three containers together:
  which image to build from where, which ports are exposed to your machine,
  and that the backend should wait until the database reports itself healthy
  before starting.
- **`.dockerignore`** files (one in `backend/`, one in `frontend/`) — tell
  Docker which files to skip when building (like your local Python virtual
  environment or `node_modules`), so images build faster and don't carry
  along things they don't need.

### Why the database keeps its data between restarts

The database's data lives in a Docker **volume** (`db_data`), which is
separate from the container itself. You can stop and remove the `db`
container entirely and restart it, and your customers/tickets/accounts are
still there — because the volume, not the container, is where the data
actually lives. Data is only lost if you explicitly run
`docker compose down -v` (that `-v` removes volumes too).

### Running it

```bash
docker compose up -d --build   # builds (if needed) and starts all 3 containers
docker compose down             # stops and removes the containers (data is kept)
docker compose logs backend     # see what a specific container is doing/printing
```

Then open **http://localhost:8080** — that's the whole app, demo accounts
included right on the login page.

## Bonus: demo accounts on the login page

The login page used to only show the three one-click demo account buttons
(Customer/Support Agent/Admin) when running the developer preview
(`npm run dev`) — a leftover check (`import.meta.env.DEV`) hid them from the
"real" production build that Docker actually serves. That check has been
removed, and the page now also prints each account's email address and the
shared password directly on screen — so anyone opening the Docker-hosted app
(like a mentor) can log in with one click, or type the credentials in
manually.

**Where:** `frontend/src/pages/auth/LoginPage.tsx`.
