# Book Recommender — Project Notes

## What this is
Milestone 2 app. A personal book library manager with two AI features:
1. **Autofill** — enter a title + author, Claude fills in genre, tropes, mood, page count, description
2. **Recommend** — describe your mood/context, Claude picks the best match from your library (unread or re-reads)

## Live URLs
- **Frontend**: (to be added after deployment)
- **Backend**: (to be added after deployment)
- **GitHub**: (to be added after deployment)

## What's been built

### Backend (`/backend`)
- Flask API — `server.py`
- SQLAlchemy + SQLite locally → PostgreSQL (Neon) in production
- NullPool for Neon compatibility (same fix as food tracker)
- Flask-Migrate for schema migrations
- Anthropic Python SDK for both AI features
- `python-dotenv` loads `backend/.env` in local dev (never commit `.env`)
- venv at `backend/venv/` — activate with `source venv/bin/activate`
- Run locally: `python3 server.py` → `http://127.0.0.1:5000`

### Book model fields
| Field | Type | Notes |
|---|---|---|
| id | Integer | Auto-generated primary key |
| title | String(200) | Required |
| author | String(200) | Required |
| genre | String(100) | e.g. "Fantasy", "Romance" |
| tropes | Text | JSON string array, e.g. `'["enemies-to-lovers"]'` |
| mood | Text | JSON string array, e.g. `'["cozy", "dark"]'` |
| page_count | Integer | Optional |
| description | Text | 2-3 sentence summary |
| format | String(20) | "physical" or "ebook" |
| read_status | String(20) | "want_to_read" / "reading" / "read" — default "want_to_read" |
| date_added | DateTime | Defaults to now |

### API endpoints
| Method | Path | What it does |
|---|---|---|
| GET | `/books` | Return all books, ordered by date_added desc |
| POST | `/books` | Add a book |
| PATCH | `/books/<id>` | Update read_status |
| DELETE | `/books/<id>` | Delete a book |
| POST | `/books/autofill` | Body: `{title, author}` → returns metadata JSON |
| POST | `/recommend` | Body: `{context, exclude_ids[]}` → returns recommendation JSON |

### AI features
**Autofill** (`POST /books/autofill`):
- Sends title + author to Claude Opus 4.8
- Returns structured JSON: genre, tropes, mood, page_count, description
- No thinking needed — simple lookup, not reasoning

**Recommend** (`POST /recommend`):
- Sends full library (all statuses) + user context to Claude Opus 4.8
- Adaptive thinking enabled — Claude reasons over the options before picking
- Claude respects status: defaults to unread books, picks from "read" pile if user mentions re-reads
- `exclude_ids` list grows with each "Suggest another" click — ensures different picks each time
- Returns: book_id, title, author, reason

### Frontend (`/frontend`)
- React 19 + Vite
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- shadcn/ui — style: nova, components: button, card, input, badge, textarea
- `VITE_API_URL` env var (falls back to `http://127.0.0.1:5000`)
- Local dev: `frontend/.env.local` sets `VITE_API_URL=http://127.0.0.1:5000`
- Run with: `npm run dev` → `http://localhost:5173`

### Current UI sections
1. **Add a book** — title + author + Autofill button; metadata fields reveal after autofill
2. **What should I read next?** — mood input → recommendation with tropes + reason; "Let's read that!" marks book as "reading"; "Suggest another" excludes current pick
3. **Library** — shows only unread/reading books, grouped by All/Genre/Format; "Read" button marks as read, "Delete" removes permanently
4. **Already read** — collapsible section at the bottom; books with status "read" live here

## Decisions made
| Decision | Choice | Reason |
|---|---|---|
| Stack | Same as food tracker (Flask + React + shadcn/ui) | Milestone 2 goal is speed, not new tools |
| AI provider | Anthropic (Claude Opus 4.8) | Best reasoning quality; Python SDK is clean |
| Metadata storage | JSON strings in Text columns | Simple for a personal app; no need for separate tropes/mood tables |
| Re-reads in recommendation | Send full library with status labels | Lets Claude reason about which pool to use based on context |

## To run locally
Terminal 1 (backend):
```bash
cd backend
source venv/bin/activate
python3 server.py
```

Terminal 2 (frontend):
```bash
cd frontend
source ~/.nvm/nvm.sh   # if npm not found
npm run dev
```

Open `http://localhost:5173`

## Environment variables
**Local** — create `backend/.env` (never commit this):
```
ANTHROPIC_API_KEY=sk-ant-...
```

**Production** (Railway):
```
DATABASE_URL=<Neon connection string>
ANTHROPIC_API_KEY=sk-ant-...
FLASK_APP=server
```

## Migration workflow
```bash
cd backend
source venv/bin/activate
FLASK_APP=server flask db migrate -m "describe the change"
FLASK_APP=server flask db upgrade
```

## Deployment setup
*(to be filled in after deployment)*

**Railway (backend)**
- Root directory: `backend`
- Start command: `flask db upgrade && gunicorn server:app`
- Env vars: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `FLASK_APP=server`

**Vercel (frontend)**
- Root directory: `frontend`
- Framework: Vite
- Env var: `VITE_API_URL=<Railway backend URL>`

**Neon (database)**
- Same setup as food tracker
