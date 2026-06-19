# Book Recommender — Project Notes

## What this is
Milestone 2 app. A personal book library manager with two AI features:
1. **Autofill** — enter a title + author, Claude fills in genre, tropes, mood, page count, description
2. **Recommend** — describe your mood/context, Claude picks the best match from your library (unread or re-reads)

## Live URLs
- **Frontend**: https://book-recommender-henna.vercel.app
- **Backend**: https://book-recommender-production-4343.up.railway.app
- **GitHub**: https://github.com/h-ortmann/book-recommender

## What's been built

### Backend (`/backend`)
- Flask API — `server.py`
- SQLAlchemy + SQLite locally → PostgreSQL (Neon) in production
- NullPool for Neon compatibility (same fix as food tracker)
- Flask-Migrate for schema migrations (3 migrations total)
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
| rating | Integer | 1–5 stars, optional |
| notes | Text | Personal notes, optional |
| date_added | DateTime | Defaults to now |

### API endpoints
| Method | Path | What it does |
|---|---|---|
| GET | `/books` | Return all books, ordered by date_added desc |
| POST | `/books` | Add a book |
| PATCH | `/books/<id>` | Partial update — any combination of fields |
| DELETE | `/books/<id>` | Delete a book |
| POST | `/books/autofill` | Body: `{title, author}` → returns metadata JSON |
| POST | `/recommend` | Body: `{context, exclude_ids[]}` → returns pick JSON `{book_id, title, author}` |
| POST | `/recommend-reason` | Body: `{title, author, genre, tropes, mood, context}` → streams reason as plain text |

### AI features
**Autofill** (`POST /books/autofill`):
- Sends title + author to Claude Opus 4.8
- Returns structured JSON: genre, tropes, mood, page_count, description
- No thinking needed — simple lookup, not reasoning

**Recommend** (`POST /recommend`):
- Sends full library (all statuses + format) + user context to Claude Opus 4.8
- Adaptive thinking enabled — Claude reasons over the options before picking
- Claude respects status: defaults to unread books, picks from "read" pile if user mentions re-reads
- Claude respects format: physical/ebook included in each library line
- `exclude_ids` list grows with each "Suggest another" click — ensures different picks each time
- Returns: `{book_id, title, author}` only — reason is streamed separately

**Stream reason** (`POST /recommend-reason`):
- Takes `{title, author, genre, tropes, mood, context}` — no adaptive thinking needed (just prose)
- Uses `claude.messages.stream()` + `stream.text_stream` to yield chunks as they arrive
- Flask returns a `Response` with `stream_with_context(generate())`, `content_type="text/plain"`, `X-Accel-Buffering: no`
- Frontend reads with `res.body.getReader()` + `TextDecoder` loop, updating `streamingReason` state on each chunk

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
3. **Currently reading** — dedicated section (shown only when books have "reading" status); "Finished" marks as read, "Not now" moves back to want_to_read
4. **Library** — collapsible; shows only want_to_read books; search bar; grouped by All/Genre/Format; "Read" marks as read, "Edit" opens inline form, "Delete" removes
5. **Already read** — collapsible section at the bottom; search bar; shows rating + notes; "Re-read" moves back to want_to_read; "Edit" opens inline form

### Inline edit form
`renderEditForm(bookId)` — defined once, used in all three card sections. Edits: title, author, genre, tropes, mood, page_count, format, description, rating (star picker), notes.

## Decisions made
| Decision | Choice | Reason |
|---|---|---|
| Stack | Same as food tracker (Flask + React + shadcn/ui) | Milestone 2 goal is speed, not new tools |
| AI provider | Anthropic (Claude Opus 4.8) | Best reasoning quality; Python SDK is clean |
| Metadata storage | JSON strings in Text columns | Simple for a personal app; no need for separate tropes/mood tables |
| Re-reads in recommendation | Send full library with status labels | Lets Claude reason about which pool to use based on context |
| Format in recommendation | Included in library lines sent to Claude | Claude can only act on what it's told — format was missing, so format preferences were ignored |
| PATCH endpoint | Accepts any subset of fields | Cleaner than separate endpoints per field |
| Streaming split | Pick via `/recommend` (JSON), reason via `/recommend-reason` (stream) | Can't stream JSON — partial JSON is unparseable, so the structured pick and the prose reason must be two separate calls |

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

## What comes next
- **Milestone 3** — start a new project from scratch with minimal guidance
- **Authentication** — users, sessions, passwords (the obvious next stack gap)
