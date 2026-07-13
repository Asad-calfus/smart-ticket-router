# Experimental & Performance Report — Smart Support Ticket Router

Honest evaluation of what has actually been measured versus estimated. Where
a number wasn't captured in this session, this doc says **"Not measured
yet"** and gives the exact command to produce it — no numbers are invented.

## 1. Goals

- Confirm the routing pipeline produces schema-valid, consistent output.
- Separate **measured** results (real runs, real timestamps) from
  **estimated** ones (fixed assumptions) and **mocked** ones (rule-based,
  offline, not real AI).
- Identify what still needs a real measurement pass.

## 2. Environment and configuration used

- Read from this machine's local `.env` (values only, no secrets copied):
  `LLM_PROVIDER=openai`, model `gpt-5-mini`; `EMBEDDING_PROVIDER=openai`,
  model `text-embedding-3-small`. This is **not** the shipped default —
  `.env.example` defaults both to `mock`.
- Database: local `pgvector/pgvector:pg16` Docker container, already running
  and seeded (confirmed via `docker ps`).
- Backend: FastAPI, confirmed running and healthy (`GET /health` → `200`).

## 3. Dataset: the 20-ticket demo set

`backend/app/db/seed.py` creates **21** unrouted (`status=Open`) demo
tickets, each targeting one edge case:

| # | Category targeted | Example |
|---|---|---|
| 1 | Angry tone | "This is absolutely ridiculous!! Your mobile app has been crashing for DAYS..." |
| 2 | Vague/short | "broken" |
| 3 | Ambiguous billing/access | "I can't log in and I think you charged me twice this month." |
| 4 | Payment deducted, access missing | "...shows active and I was charged, but I still can't access any payment features." |
| 5 | Active regional incident | "Premium Dashboard is not opening for me at all this morning..." |
| 6 | Security concern | "I think someone else logged into my account..." |
| 7 | Refund request | "I want a refund for my Analytics Suite subscription..." |
| 8 | General product question | "Does Analytics Suite support exporting reports to CSV?" |
| 9 | Multilingual (Hindi) | "मेरा डैशबोर्ड नहीं खुल रहा है, कृपया मदद करें।" |
| 10 | Repeated unresolved issue | "This is the third time I'm writing about..." |
| 11 | Customer without claimed access | "I should have access to Premium Dashboard on my plan but it says..." |
| 12 | Low-priority feature request | "It would be nice if the Mobile App had a dark mode..." |
| 13 | Very short | "help" |
| 14 | Ambiguous account-access vs. technical | "I keep getting logged out... don't know if it's a bug or my account was suspended..." |
| 15 | Angry + genuine outage | "Our production Analytics Suite dashboards are COMPLETELY DOWN company-wide..." |
| 16 | Product/pricing query | "What's the difference between Standard and Premium plans?" |
| 17 | Repeated billing complaint | "You charged me again even though I cancelled..." |
| 18 | Phishing/security report | "I received a suspicious email asking me to confirm my password..." |
| 19 | Mixed-language | "Mera account not working properly hai, kripya help kijiye jaldi se." |
| 20 | Incident-adjacent, different location | "Premium Dashboard is loading really slowly for me today..." |
| 21 | Very long message | ~180-word multi-issue message |

There is no dedicated seeded **numeric-only** ticket; that case is covered
only by a unit test (see §4), not the demo set.

Run the whole set: `python -m app.db.run_demo_tickets` (prints a table of
category/priority/team/confidence for all 21). The same set is exercised in
`backend/tests/test_demo_tickets.py::test_all_demo_tickets_route_successfully_and_validate`.

## 4. Test categories vs. what's actually tested

Based on `backend/tests/test_routing.py`, `test_llm_providers.py`,
`test_retrieval.py`, `test_demo_tickets.py`, `test_config.py`.

| Test | Input type | Expected behaviour | Actual result | Pass/Fail | Evidence |
|---|---|---|---|---|---|
| `test_ten_consecutive_routing_responses_are_schema_valid` | Normal, x10 | All 9 `RoutingResult` fields present and valid | Confirmed by test assertions | Not run this session | `backend/tests/test_routing.py` |
| `test_angry_tone_alone_does_not_raise_priority` | Angry tone | Priority not forced High by tone alone | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_angry_tone_with_genuine_outage_is_still_high` | Angry + outage | Priority High | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_broken_message_returns_needs_clarification_with_questions` | Vague/short ("broken") | Needs Clarification, ≥1 question, human review | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_numeric_only_message_is_always_low_priority_...` | Numeric-only | Forced Low priority regardless of context | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_empty_message_returns_validation_error` | Empty input | HTTP 422, no ticket created | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_too_long_message_returns_validation_error` | Very long input | HTTP 422 | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_security_report_is_high_priority` | Security incident | Category Security, priority High | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_active_regional_incident_raises_priority` | Outage/incident | Priority High, incident evidence non-empty | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_llm_failure_returns_safe_fallback_not_a_crash` | API failure (mocked) | 200, General Support, human review | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_malformed_llm_output_is_retried_then_falls_back` | Malformed JSON (mock path) | Retried `LLM_MAX_ATTEMPTS` times, then fallback | Confirmed by test assertions | Not run this session | `test_routing.py` |
| `test_invalid_openai_output_triggers_retry_then_fallback` | Malformed JSON (OpenAI path) | Same retry/fallback behaviour | Confirmed by test assertions | Not run this session | `test_llm_providers.py` |
| **Multilingual input** | Hindi/mixed-language | — | **No dedicated backend test asserts language-specific behaviour** — only covered generically (schema validity only) via the demo-ticket test | N/A | Gap — see §9 |

"Confirmed by test assertions" means: verified by reading the test's actual
assertions in this session, and the full suite was confirmed to **collect**
successfully (`pytest --collect-only`, 96 tests, no DB writes). The suite was
**not executed** in this session — running it exercises the live seeded dev
database (routes/resolves/reassigns real ticket rows), and this session was
told not to run expensive or state-mutating operations against it.

**To reproduce a real pass/fail run:**
```bash
cd backend && source .venv/bin/activate
python -m pytest tests/ -v
```

## 5. JSON validity across 10 consecutive inputs

Covered by `test_ten_consecutive_routing_responses_are_schema_valid` — asserts
schema validity across 10 different messages in one run. **Not executed this
session** (see §4). To measure: run the command above and check that test's
result specifically:
```bash
python -m pytest tests/test_routing.py::test_ten_consecutive_routing_responses_are_schema_valid -v
```

## 6. Required-field validation / same-input consistency

Both covered by existing tests (`test_routing_result_rejects_confidence_out_of_range`,
`test_same_input_produces_equivalent_routing`) — **not executed this session**;
same reproduction command as §4.

## 7. Manual vs. AI routing time

**Measured, from this dev database's actual history** (queried read-only via
`GET /api/metrics/summary`, logged in as the demo agent account — no data was
changed):

| Metric | Value | Type |
|---|---|---|
| Total routed tickets (all-time, this DB) | 83 | Measured |
| Routing-evidence rows (real pipeline runs) | 55 | Measured |
| Avg. AI routing time | 6.69s (6,686 ms) | **Measured** — SQL `AVG(routing_time_ms)` over all routed tickets |
| Min / max AI routing time (from `routing_evidence`, provider=openai, model=gpt-5-mini, n=55) | 0 ms / 14,623 ms | Measured |
| Estimated manual routing time | 240s (4 min) | **Estimated** — fixed assumption in `metrics_service.py` (`ESTIMATED_MANUAL_ROUTING_SECONDS`), not a real timed study |
| Estimated time saved | ~233.3s/ticket | Derived from the two numbers above |
| Provider used for measured figures | OpenAI (`gpt-5-mini` chat, `text-embedding-3-small` embeddings) — **not mock mode** | — |

Caveats (threats to validity, see §9): the 83/55 figures are a **cumulative
history** across however many routing calls have been made on this machine
over time — not a single controlled experiment with a fixed N run
back-to-back. The 0 ms minimum is very likely a fallback path (no real
network call made), not a genuinely instant real classification.

**Accepted vs. corrected AI decisions:** 2 accepted, 0 corrected, from
`RoutingFeedback` rows in this database. Sample size is too small (n=2) to
draw any accuracy conclusion — reported for transparency only, not as a
pass-rate.

## 8. RAG/context vs. no-context comparison

The Context Comparison demo (`ContextComparisonPanel.tsx`, "Route Without vs
With Context" button) makes two real, non-persisting `POST /api/tickets/route`
calls (`use_context=false` / `true`) and shows the two results side by side.
`test_route_without_context_misses_the_incident_boost_that_context_catches`
asserts the with-context run reaches High priority via the active-incident
signal while the without-context run does not. **Not executed this session**
(no automated before/after numbers were captured); to see it live, log in as
`agent@example.com` and click the button in the workspace on an incident-linked
ticket.

## 9. Known threats to validity

- **Mocked tests prove code behaviour, not real OpenAI accuracy.** Most
  backend tests use the deterministic mock classifier by default; only
  `test_llm_providers.py` exercises the real-OpenAI code path, and even there
  the OpenAI response is faked (monkeypatched), not a live API call. A test
  passing confirms the *pipeline* (validation, retry, safeguards) works —
  it does not confirm a real model's classification is accurate.
- The §7 timing figures are historical/cumulative, not from a fresh, isolated,
  fixed-N benchmark run — they mix however many manual/test/demo routing
  calls happened to be made on this machine.
- No multilingual-specific backend assertion exists (§4) — Hindi/mixed-language
  handling is only exercised generically via the demo-ticket schema-validity
  test, not verified for language-appropriate categorization.
- No labelled ground-truth dataset exists for category/priority "correctness"
  — this repo has no human-annotated answer key, so no accuracy/precision
  number can be honestly computed. Only pass/fail against behavioural
  assertions (e.g. "priority must be High") is possible today.
- Manual routing time (240s) is an industry-standard assumption written in
  code, not a timed observation of a real human agent.
- Feedback sample size (n=2 accepted, n=0 corrected) is too small for any
  agreement-rate conclusion.

## 10. Not measured yet

The following require running commands not executed in this session (either
because they mutate the live seeded dev database, or require a fresh,
deliberately-scoped run):

- Full backend suite pass/fail counts: `cd backend && python -m pytest tests/ -v`
- Full frontend suite pass/fail counts: `cd frontend && npm run test`
- Playwright E2E results: `cd frontend && npm run test:e2e`
- A fresh, isolated AI-routing-time benchmark (fixed N, single run, timestamped):
  ```bash
  cd backend && source .venv/bin/activate
  python -m app.db.run_demo_tickets
  ```
- Malformed-JSON / retry-then-fallback behaviour against a **live** OpenAI
  call (as opposed to the monkeypatched test) — would require intentionally
  triggering a bad response from the real API, which was not attempted here
  to avoid unnecessary real API usage.
