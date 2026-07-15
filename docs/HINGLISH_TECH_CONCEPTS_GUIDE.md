# Smart Ticket Router — Sabhi Tech Concepts (Mentor ke liye Prep Guide)

Ye document isliye banaya gaya hai ki **mentor ke saamne project explain karte waqt** koi bhi
technical cheez puchi jaye to confidently answer de sako. Har concept ka:
1. **Kya hai** (easy language mein)
2. **Kyun use kiya** (is project mein iski zaroorat kyun padi)
3. **Kahan use hua** (konsi file/feature mein)

...cover kiya gaya hai. Ek dum ratt-ke jaane ki zaroorat nahi — bas ek baar poora padh lo,
samajh mein aajayega kyunki sab kuch real project ke context mein explain hai.

---

## 0. Project ek line mein

**Smart Support Ticket Router** — ek aisa system jo customer ke support ticket ko padhta hai,
AI se uska category/priority/team decide karwata hai, apne fixed rules se double-check karta
hai, aur fir human agent ko final decision ke liye bhejta hai.

> Important line jo mentor ko bolni hai: **"Ye system ticket resolve nahi karta, sirf route/triage
> karta hai — final decision hamesha human agent leta hai."** Ye responsible-AI ka sabse bada point hai.

**Flow (yaad rakhne layak):**
```
Customer ticket submit karta hai
   → Backend customer ka data, active incidents, purane similar tickets nikalta hai
   → AI (OpenAI/Anthropic/mock) category+priority+team suggest karta hai
   → Backend ke fixed safety rules double-check karte hain
   → Agent dekh ke accept/correct karta hai
```

---

## 1. Bada Picture — Architecture (system ke 4 hisse)

Har professional app 4 layers mein bant hota hai — isko samajhna sabse zaroori hai kyunki
mentor ka pehla sawaal aksar "architecture batao" hi hota hai.

```
[ Frontend (React) ]  <-- browser mein chalta hai, UI dikhata hai
        |  (HTTP requests, cookie ke through login)
[ Backend (FastAPI) ]  <-- server pe chalta hai, saara business logic yahin hai
        |
   /----+----\
[ Database ]   [ AI Provider ]
[ PostgreSQL ]   [ OpenAI/Anthropic ]
[ + pgvector ]
```

- **Frontend** = jo user dekh/click karta hai (website)
- **Backend** = jo asli kaam karta hai — data validate karna, database se baat karna, AI se
  baat karna, security check karna
- **Database** = jahan data permanently store hota hai (customers, tickets, users, sab kuch)
- **AI Provider** = external service (OpenAI ya Anthropic) jo ticket ko classify karti hai

**Golden rule jo mentor ko impress karega:** "Frontend sirf UI dikhata hai, **real security
aur business rules backend mein hain** — kyunki frontend ko koi bhi browser dev-tools se
bypass kar sakta hai, backend nahi."

---

## 2. Frontend Tech Stack

### React
**Kya hai:** Ek JavaScript library jisse UI ko chote-chote reusable "components" mein banate
hain (jaise LEGO blocks — TicketQueue block, ConversationPanel block, etc.)
**Kyun:** Agar plain HTML/JS use karte to har button/form ka code baar-baar likhna padta.
React mein ek component banao, jahan chahiye wahan use kar lo.
**Kahan:** `frontend/src/components/*.tsx` — jaise `TicketQueue.tsx`, `AIRecommendationCard.tsx`,
`Customer360.tsx`.

### TypeScript
**Kya hai:** JavaScript + "types" (matlab har variable ko batana padta hai ye number hai ya
text hai ya object hai).
**Kyun:** Agar galti se `priority` field mein number bhej diya jab wahan text chahiye tha, to
TypeScript **code likhte waqt hi** error de dega — production mein crash hone se pehle hi
pakad lega.
**Kahan:** Pura frontend `.tsx` files mein hai, plus `frontend/src/types/index.ts` mein backend
ke sath matching type-definitions hain.

### Vite
**Kya hai:** Ek build tool — jo development ke waqt tumhara code turant browser mein reflect
karta hai (save karo, 1 second mein screen update), aur production ke liye code ko compress/
optimize karta hai.
**Kyun:** Purane tools (jaise Webpack) slow the. Vite bahut fast hai.
**Kahan:** `npm run dev` command Vite hi chalata hai. Config: `frontend/vite.config.ts`.

### Tailwind CSS
**Kya hai:** CSS likhne ka ek style — alag `.css` file banane ke bajaye directly HTML/JSX mein
chote utility classes likhte hain, jaise `class="bg-blue-500 p-4 rounded"`.
**Kyun:** Fast styling, aur pura app ek consistent look-and-feel maintain karta hai (design
system) bina alag CSS files manage kiye.

### React Router
**Kya hai:** Browser ke andar "pages" ke beech navigate karne ka tareeka, bina poora page
reload kiye (Single Page Application - SPA).
**Kahan:** Customer ke pages, Agent workspace, Admin pages — sab alag "routes" hain (`/login`,
`/tickets`, `/admin/agents` waghera). File: `frontend/src/App.tsx`.

### Context API (React Context)
**Kya hai:** React ka apna built-in tareeka data ko "globally" share karne ka, bina har
component mein manually pass kiye.
**Kyun:** "Kaun login hai" (AuthContext) aur "dark mode ya light mode" (ThemeContext) jaisi
cheezein har component ko chahiye — Context se ek jagah define karo, sab jagah access ho jaye.
**Kahan:** `frontend/src/contexts/AuthContext.tsx`, `ThemeContext.tsx`.

### Testing tools (frontend)
- **Vitest** — unit tests chalane ka tool (jaise "check karo ki TicketQueue sahi tickets
  dikha raha hai ya nahi") — `npm run test`.
- **React Testing Library** — components ko test karne ka tareeka jo "user jaisa" interact
  karta hai (button click karna, text dhoondhna) instead of internal code check karna.
- **Playwright** — End-to-End (E2E) testing — ek real browser khol ke, real click karke,
  poora flow test karta hai (login se lekar ticket resolve tak). `npm run test:e2e`.
- **oxlint** — code quality checker (linter) — galat/messy code likhne se rokta hai.

---

## 3. Backend Tech Stack

### Python + FastAPI
**Kya hai:** FastAPI ek Python framework hai APIs banane ke liye (REST API — matlab frontend
aur backend HTTP requests ke through baat karte hain: GET, POST, etc.)
**Kyun:** FastAPI fast hai, automatic documentation banata hai (`/docs` page), aur Pydantic ke
saath directly kaam karta hai (validation free milti hai).
**Kahan:** `backend/app/main.py` entry point hai, `backend/app/api/*.py` mein saare
endpoints (`auth.py`, `tickets.py`, `admin.py`, etc.)

### Pydantic
**Kya hai:** Data validation library — batata hai ki request/response mein data ka "shape"
kaisa hona chahiye (kaunse fields required hain, kaunsa type honi chahiye).
**Kyun ye is project ka sabse important concept hai:** AI kabhi-kabhi galat/adhoora JSON
bhej sakta hai. Pydantic ka `RoutingResult` schema guarantee karta hai ki AI ka jawaab hamesha
sahi shape mein ho — agar nahi hai to error throw karega, aur code retry/fallback kar dega.
**Kahan:** `backend/app/schemas/*.py`. Example — `RoutingResult` schema mein `category`,
`priority`, `confidence` (0.0 se 1.0 ke beech), `reasoning` sab strictly defined hain.

### SQLAlchemy (ORM)
**Kya hai:** ORM = Object-Relational Mapper. Matlab raw SQL query (`SELECT * FROM tickets...`)
likhne ke bajaye, Python classes/objects se database ke saath kaam karte hain.
**Kyun:** Python code se database rows ko normal objects jaisa treat kar sakte hain
(`ticket.category`, `ticket.priority`) — safer aur readable.
**Kahan:** `backend/app/models/*.py` — har file ek database table represent karti hai
(`ticket.py`, `customer.py`, `user.py`, etc.) — total 17 tables.

### Alembic
**Kya hai:** Database "migrations" tool — jab database structure change karna ho (naya column
add karna, naya table banana), to Alembic uska record rakhta hai step-by-step, taaki koi bhi
machine pe same schema recreate ho sake.
**Kyun:** Bina iske, agar 2 developers apne-apne database schema change kar de, to sab out of
sync ho jayega. Alembic ek versioned history maintain karta hai.
**Kahan:** `backend/migrations/versions/*.py` — 8 migrations hain abhi tak, jaise
"add routing_evidence token usage", "add reopened status", etc. Command: `alembic upgrade head`.

### Uvicorn
**Kya hai:** ASGI server — matlab wo program jo actually FastAPI app ko internet pe "serve"
karta hai (chalata hai).
**Kahan:** `uvicorn app.main:app --reload --port 8000`.

### Argon2 (password hashing)
**Kya hai:** Password ko plain text mein kabhi save nahi karte — usko ek irreversible
"hash" mein convert karte hain. Argon2 is waqt ka sabse secure hashing algorithm hai (2015 ka
Password Hashing Competition winner).
**Kyun:** Agar database hack bhi ho jaye, hackers ko real password nahi milega, sirf hash
milega jisse wapas password nikalna practically impossible hai.
**Kahan:** `backend/app/core/security.py`.

### python-dotenv / Pydantic Settings
**Kya hai:** `.env` file se secrets/config (API keys, database URL) load karna, code mein
hardcode karne ke bajaye.
**Kyun:** Security best practice — API keys kabhi bhi code/git mein commit nahi karte.
**Kahan:** `backend/app/core/config.py`, root ka `.env.example`.

### Pytest
**Kya hai:** Python ka testing framework.
**Kahan:** `backend/tests/` mein 96 test functions, 10 files mein — routing rules, auth,
authorization, retrieval, edge cases sab test hote hain. Command: `pytest tests/ -v`.

---

## 4. Database Concepts

### PostgreSQL
**Kya hai:** Ek relational database — matlab data tables mein store hota hai (rows aur
columns), aur tables ek doosre se "relations" (foreign keys) se judi hoti hain — jaise
`ticket` table mein `customer_id` column hai jo `customer` table se link karta hai.

### pgvector (extension)
**Kya hai:** Postgres ka ek special extension jo "vector" data type support karta hai —
matlab numbers ki list (jaise `[0.12, -0.5, 0.33, ...]`, 384 numbers is project mein) ko
store aur compare kar sakta hai.
**Kyun is project mein zaroori hai:** AI text ko "embedding" (ek vector) mein convert karta
hai, aur pgvector do embeddings ke beech "cosine distance" (kitne similar hain) calculate
karta hai — isi se system purane similar tickets dhoondh pata hai.
**Kahan:** `tickets.embedding`, `knowledge_documents.embedding` columns.
Query: `ORDER BY embedding <=> :query_vector LIMIT 5`.

### Database Enums
**Kya hai:** Fixed list of allowed values (jaise `TicketStatus` sirf ye values le sakta hai:
Open, Routed, In Progress, Needs Human Review, Resolved, Reopened).
**Kyun:** Database level pe guarantee milta hai ki koi galat/random value save na ho jaye.

---

## 5. AI / LLM Concepts (sabse important section — mentor yahi sabse zyada puchega)

### LLM (Large Language Model)
**Kya hai:** AI model (jaise OpenAI ka GPT ya Anthropic ka Claude) jo text samajhta aur
generate karta hai.
**Is project mein role:** Ticket ka message padh ke category/priority/team decide karta hai,
saath mein ek reasoning (kyun ye decision liya) bhi deta hai.

### Prompt Engineering
**Kya hai:** AI ko sahi tareeke se instruction dena taaki wo predictable, useful jawaab de.
**Kahan:** `build_prompt()` function (`routing_service.py`) — isme fixed rules hote hain
(jaise "angry tone se priority mat badhao"), allowed values ki list, aur customer ka context —
sab combine karke ek prompt banta hai jo AI ko bheja jata hai.

### Structured Output / JSON Schema Validation
**Kya hai:** AI ko force karna ki wo free-flowing text ke bajaye ek fixed JSON format mein
jawaab de (jaise `{"category": "Billing", "priority": "High", ...}`), aur fir us JSON ko
Pydantic se validate karna.
**Kyun:** Bina iske AI kabhi bhi kuch bhi format mein bol sakta hai — code crash ho sakta hai.
Isse guarantee milta hai ki output hamesha usable hai.

### RAG (Retrieval-Augmented Generation)
**Kya hai:** AI ko sirf apne "training data" pe depend karne ke bajaye, real-time database se
relevant facts nikal ke uske prompt mein daal dena — taaki AI ka jawaab company ke real data pe
based ho, sirf guess na ho.
**Is project mein:** Customer ka profile, active incidents, 5 similar purane resolved tickets,
aur 3 relevant knowledge documents — ye sab "retrieve" karke prompt mein daale jate hain, phir
AI classify karta hai. Isi wajah se "Context Comparison" demo feature hai jo dikhata hai ki
context ke bina vs. context ke saath AI ka jawaab kitna different hota hai.

### Embeddings + Cosine Similarity
**Kya hai:** Text ko numbers ki list (vector) mein convert karna, jisse "similar meaning wale
text ek doosre ke close honge" — jaise "app crash ho raha hai" aur "app band ho jata hai"
dono ka vector kaafi close hoga.
**Cosine distance** = do vectors ke beech ka "angle" measure karta hai — kam distance =
zyada similar.
**Kahan:** `embedding_service.py` — mock mode mein (free) hashing-based fake embedding banta
hai, real mode mein OpenAI ka embedding model use hota hai.

### Confidence Score aur Human-Review Threshold
**Kya hai:** AI apne jawaab ke saath ek number (0.0 se 1.0) deta hai ki wo apne decision pe
kitna sure hai.
**Kyun:** Agar confidence `0.6` se kam hai, to system automatically `needs_human_review=True`
mark kar deta hai — matlab AI khud maan raha hai "mujhe pakka nahi pata, insaan check kare".

### Retry + Fallback Pattern
**Kya hai:** Agar AI ka jawaab galat format mein aaya (malformed JSON) ya AI service down hai,
to system ek baar aur try karta hai (retry). Agar wo bhi fail ho jaye, to ek safe default
jawaab de deta hai (fallback) — kabhi crash nahi hota.
**Kahan:** `LLM_MAX_ATTEMPTS = 2`, aur `FALLBACK_RESULT` jo "General Support, needs review"
bhej deta hai.

### Backend Safety Rules (Guardrails)
**Kya hai:** AI ke jawaab ke upar, fixed hardcoded rules jo hamesha 100% chalte hain, AI pe
depend nahi karte. Jaise: "Security issue hamesha High priority", "Angry tone akela priority
nahi badha sakta", "confidence < 0.6 to human review force karo".
**Kyun ye important hai bolna mentor ko:** Ye dikhata hai ki system **"AI-only" nahi hai** —
AI ek suggestion deta hai, par critical business rules hamesha backend khud enforce karta hai.
Ye "Responsible AI" design ka core idea hai.

### Mock Mode
**Kya hai:** Bina kisi real API key ke, ek simple keyword-based fake AI/embedding jo free aur
offline chalta hai — development/demo ke liye.
**Kyun:** Taaki koi bhi bina paisa kharch kiye project chala/test kar sake.

### Model Routing (chota vs bada model)
**Kya hai:** Har task ko sabse bade/mehenge AI model pe bhejna zaroori nahi. Simple tasks
(jaise 6 categories mein classify karna) ke liye chota/sasta model (`gpt-5-mini`) kaafi hai.
**Kyun:** Cost bachana bina quality kharab kiye.

### Reasoning Effort / Token Optimization
**Kya hai:** Naye AI models (jaise gpt-5-mini) "invisible thinking" karte hain jawaab dene se
pehle — jo tokens (aur paisa) kharch karta hai lekin app kabhi dekhta nahi.
**Is project ki real finding:** Default settings mein **79% tokens sirf hidden thinking mein**
waste ho rahe the. `reasoning_effort="minimal"` set karne se **41% kam tokens** lage, bilkul
same quality ke saath — real test calls se verify kiya gaya.
**Kyun bolna important hai:** Ye ek measured, real-world cost-optimization hai — mentor ko
bahut acha lagega ye sunke ki sirf assumption nahi, real numbers measure kiye gaye.

### Prompt Caching
**Kya hai:** Agar prompt ka ek hissa (jaise rules/instructions) har request mein same rehta
hai, to AI provider usko cache kar leta hai aur agli baar sasta charge karta hai (~90% off).
**Kahan:** Static block (rules + instructions) hamesha prompt ke start mein rakha gaya hai —
isse OpenAI ka automatic caching free mein fayda deta hai.

### Encryption at Rest (per-agent API keys)
**Kya hai:** Har agent apni personal API key save kar sakta hai (LLM Settings page), aur wo
key database mein save hone se pehle **encrypt** ho jaati hai — matlab locked-safe jaisa,
koi bhi (khud app bhi) usko dobara plain text mein nahi dekh sakta, sirf last 4 digits dikhte
hain.
**Kahan:** `backend/app/core/crypto.py` — `cryptography` Python library use hoti hai.

---

## 6. Security / Authentication Concepts

### Session-based Auth (JWT nahi)
**Kya hai:** Login karne pe ek random secure token banta hai (`secrets.token_urlsafe(32)`),
uska sirf **hash** database mein save hota hai, aur asli token ek secure cookie mein browser
ko diya jata hai.
**Kyun JWT nahi:** Session ko server-side revoke kiya ja sakta hai turant (logout/password
reset pe) — JWT ko revoke karna mushkil hota hai jab tak wo expire na ho.

### HttpOnly Cookie
**Kya hai:** Ek cookie setting jisse browser ka JavaScript us cookie ko **read nahi kar
sakta** — sirf server hi use kar sakta hai.
**Kyun:** XSS attack (malicious script injection) se session token chori hone se bachata hai.

### CSRF Protection (Double-Submit Cookie)
**Kya hai:** CSRF = ek attack jaha koi doosri website secretly tumhare login session ka
use karke request bhej deti hai. Isse rokne ke liye ek dusra cookie (`csrf_token`, jo
JavaScript padh sakta hai) frontend ek header (`X-CSRF-Token`) mein wapas bhejta hai — dono
match kare tabhi request accept hoti hai.
**Kahan:** `app/api/deps.py`.

### RBAC (Role-Based Access Control)
**Kya hai:** Alag-alag roles (Customer, Support Agent, Admin) ke alag-alag permissions.
**Kyun important:** Frontend sirf buttons hide karta hai UI ke liye, par **asli check backend
mein hota hai** (`require_customer`/`require_agent`/`require_admin` dependencies) — isliye
koi bhi API directly hit karke bhi bypass nahi kar sakta.

### Rate Limiting
**Kya hai:** Ek IP/email se kitni baar login attempt ho sakta hai, uski limit (jaise 10
attempts/60 seconds) — brute-force password guessing rokne ke liye.

### Mass-Assignment Protection
**Kya hai:** Request schemas mein sirf wahi fields hoti hain jo user ko change karne dena hai
— jaise customer apna `tier` ya `customer_id` khud se change nahi kar sakta, kyunki wo schema
mein hai hi nahi.

### 404 vs 403 (Information Leak Prevention)
**Kya hai:** Agar customer A, customer B ka ticket access karne ki koshish kare, to system
`404 Not Found` deta hai, `403 Forbidden` nahi — taaki attacker ko ye bhi pata na chale ki
wo ticket ID exist bhi karti hai ya nahi.

---

## 7. DevOps / Docker Concepts

### Docker & Containers
**Kya hai:** Container = ek "sealed shipping box" jisme app ka poora environment (Python
version, packages, sab kuch) already pack hota hai. Har machine pe **exactly same** tareeke se
chalta hai.
**Kyun:** Bina Docker, har developer ke system pe Python/Node/Postgres version match karna
padta tha — jhanjhat. Docker se "ek baar banao, kahin bhi chalao".

### Docker Compose
**Kya hai:** Ek recipe file (`docker-compose.yml`) jo batati hai kitne containers chahiye
(is project mein 3: db, backend, frontend), aur wo aapas mein kaise connect honge.
**Command:** `docker compose up -d --build`

### Docker Volume
**Kya hai:** Container ke bahar ek jagah jaha data permanently store hota hai. Container ko
delete karke phir se banao, data phir bhi safe rehta hai (jab tak volume delete na karo).
**Kahan:** `db_data` volume — Postgres ka saara data isme hai.

### Nginx (Reverse Proxy)
**Kya hai:** Ek lightweight web-server jo frontend ki built files serve karta hai, aur
`/api/` se start hone wali requests ko automatically backend container ko forward kar deta
hai.
**Kyun:** Isse browser ko sirf ek hi address (`localhost:8080`) se baat karni padti hai —
CORS (cross-origin) ka jhanjhat hi nahi rehta.

### CORS
**Kya hai:** Browser ka ek security rule jo alag-alag "origins" (domains/ports) ke beech
request ko by-default block karta hai.
**Is project mein:** Docker setup mein nginx ki wajah se CORS ki zaroorat hi nahi padti (ek
hi origin se sab kuch serve hota hai). Local dev mein alag origins hain isliye backend
`CORS_ORIGINS` explicitly allow karta hai.

---

## 8. Software Architecture Concepts

### Layered Architecture (Separation of Concerns)
Backend code 4 clean layers mein bata hua hai:
- **api/** — sirf HTTP requests handle karta hai (routes)
- **services/** — asli business logic yahan hai (routing_service, auth_service, etc.)
- **models/** — database tables ka Python representation
- **schemas/** — request/response ka data-shape (Pydantic)

**Kyun mentor ko ye batana important hai:** Ye industry-standard pattern hai — isse code
maintainable/testable rehta hai, aur ek layer change karne se doosri layers break nahi hoti.

### Background Tasks (Async Processing)
**Kya hai:** Customer jab ticket submit karta hai, to turant `202 Accepted` response mil jaata
hai (ticket create ho gaya), lekin AI classification **background mein** chalti hai — customer
ka page har 2 second mein poll (check) karta hai jab tak result na aa jaye.
**Kyun:** Agar AI call 5-10 second leta hai, to customer ko poora time wait nahi karana — turant
confirmation de do, result baad mein update ho jayega.

### Idempotency
**Kya hai:** Same operation baar-baar chalane pe bhi result same rehta hai, side-effects
duplicate nahi hote. Jaise agar background routing retry ho jaye, to `route_created_ticket`
check karta hai "agar category already set hai to dobara mat karo".

### Audit Logging
**Kya hai:** Har important action (assign, note add karna, agent invite karna) ek permanent
log mein record hota hai — kisne, kab, kya kiya.
**Kyun:** Accountability aur security ke liye — baad mein trace kar sakte ho ki kya hua tha.

---

## 9. Testing Concepts

| Type | Kya check karta hai | Is project mein | Tool |
|---|---|---|---|
| **Unit Test** | Ek chota function/piece sahi kaam kar raha hai ya nahi | 96 backend tests, 35 frontend tests | Pytest, Vitest |
| **Integration Test** | Multiple pieces sath mein sahi kaam kar rahe hain (jaise API + database) | Routing tests jo poora flow test karte hain | Pytest + test DB |
| **E2E (End-to-End) Test** | Poora real user flow, real browser mein | Login → route ticket → accept flow | Playwright |

**Bolne layak line:** "Humare paas teeno level ki testing hai — unit, integration, aur E2E —
isse bugs jaldi pakde jaate hain aur production mein surprise nahi aata."

---

## 10. Scalability Concepts (Bonus — agar mentor "future/scale" pe puche)

Ye sab **abhi implement nahi hai**, lekin project mein documented hai ki demo-scale se aage
badhne pe kya karna padega — mentor ko ye batana dikhayega ki tumne "production readiness"
pe bhi socha hai.

- **Horizontal Scaling** — ek se zyada backend servers chalana load handle karne ke liye.
  Abhi rate-limiter aur background tasks **in-memory** hain (ek hi process ki memory mein) —
  jo multiple servers ke saath kaam nahi karega bina Redis ke.
- **Redis** — ek fast in-memory database, commonly cache aur shared-state ke liye use hoti
  hai (rate limiting, job queue sab isi pe move karne ka plan hai).
- **Job Queue (Celery/RQ)** — background tasks ko ek proper queue system mein daalna, taaki
  server restart hone pe bhi task lost na ho.
- **Connection Pooling** — database ke saath kitne connections ek saath khule rah sakte hain,
  uski limit set karna — taaki bahut saare requests aane pe database crash na ho.
- **HNSW Index** — pgvector similarity search ko fast banane ke liye ek special index (abhi
  demo-scale data pe zaroorat nahi, hazaron rows hone pe zaroori hoga).
- **Caching layers** — embedding cache, context cache — repeated/same requests pe dobara
  expensive kaam (AI call, DB query) na karna.

---

## 11. Quick Cheat-Sheet (revision ke liye, ek nazar mein)

| Concept | Ek line mein |
|---|---|
| React | UI components banane ka library |
| TypeScript | JavaScript + type-safety |
| Vite | Fast dev server/build tool |
| Tailwind CSS | Utility-class based styling |
| FastAPI | Python REST API framework |
| Pydantic | Data validation/schema |
| SQLAlchemy | Python ↔ Database ka ORM |
| Alembic | Database schema migrations |
| PostgreSQL | Relational database |
| pgvector | Vector similarity search extension |
| LLM | AI model jo text samajhta hai |
| RAG | Real data ko AI prompt mein daalna |
| Embedding | Text → numbers (vector) |
| Confidence score | AI apne jawaab pe kitna sure hai |
| Backend safeguards | AI ke upar hardcoded safety rules |
| Session + Cookie | Login track karne ka tareeka |
| CSRF token | Fake cross-site requests rokna |
| RBAC | Role ke hisaab se permission |
| Argon2 | Password hash karne ka secure algorithm |
| Docker | App ko sealed container mein pack karna |
| Docker Compose | Multiple containers ek sath chalana |
| Nginx | Web server + traffic forwarder |
| Background Task | Bina wait kiye async kaam karna |
| Audit Log | Kisne kya kiya, uska record |
| Unit/E2E test | Code sahi hai, ye automatically verify karna |

---

## 12. Mentor ke Likely Sawaal + Suggested Jawaab

**Q: "AI galat jawaab de to kya hoga?"**
> "Do level ki safety hai — pehla, Pydantic schema validation jo galat-format jawaab ko
> reject karke retry karti hai, aur agar wo bhi fail ho to safe fallback milta hai. Doosra,
> backend ke fixed rules jo AI ke jawaab ke upar hamesha chalte hain (jaise security issue
> hamesha High priority) — chahe AI kuch bhi bole."

**Q: "Ye poora automated hai, insaan ka role kya hai?"**
> "System sirf **route/triage** karta hai, **resolve nahi karta**. Har AI suggestion agent ke
> paas jaati hai reasoning aur evidence ke saath, aur agent accept/correct/reassign kar sakta
> hai. Final decision hamesha human ki hai."

**Q: "Bina API key ke chal sakta hai?"**
> "Haan — 'mock mode' hai jisme free, offline, keyword-based classifier chalta hai. Real AI
> key dalne pe OpenAI/Anthropic use hota hai. Isse koi bhi bina cost ke poora app try kar
> sakta hai."

**Q: "Security kaise handle ki hai?"**
> "Session-based auth (JWT nahi) with HttpOnly cookies, CSRF double-submit protection,
> Argon2 password hashing, role-based access control jo backend mein enforce hota hai, aur
> rate limiting brute-force attempts ke against."

**Q: "Scale kaise karoge agar traffic badh jaye?"**
> "Abhi rate-limiter aur background tasks single-process mein hain — Redis + job queue
> (Celery/RQ) pe move karna pehla step hoga. Uske baad pgvector pe HNSW index, connection
> pool sizing, aur caching layers add karenge. Ye sab humne already document kar rakha hai
> `SCALABILITY_AND_OPTIMIZATION.md` mein."

**Q: "Cost kaise control kiya AI ka?"**
> "Real measurement karke pata chala ki 79% tokens sirf AI ki invisible 'thinking' mein waste
> ho rahe the. `reasoning_effort=minimal` set karke 41% tokens bacha liye, bina quality
> kharab kiye — aur ye real test calls se verify bhi kiya."

---

*Reference: Ye sab concepts is repo ke actual code/docs se liye gaye hain — `README.md`,
`docs/TECHNICAL_GUIDE.md`, `docs/token-optimization.md`, `docs/SCALABILITY_AND_OPTIMIZATION.md`,
`docs/RECENT_UPDATES.md`, `docs/DETAILED_DELIVERABLES.md`. Presentation karte waqt in files ko
side mein khula rakho — koi bhi detail chahiye ho to turant dikha sakte ho.*
