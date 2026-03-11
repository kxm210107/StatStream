# StatStream

A full-stack NBA analytics dashboard with live game tracking, player and team stats, lineup analysis, win probability modeling, and personalized user accounts.

## Features

### Analytics
- **Team Search** — season-by-season team stats, player breakdowns, and advanced metrics
- **Live** — real-time game scores, play-by-play animations, and live win probability curves
- **Lineups** — lineup impact analysis with configurable minimum minutes and sortable columns
- **Roster** — full team roster with positions and player details
- **Top Scorers** — league-wide scoring leaders by season
- **Team Comparer** — side-by-side comparison of two teams across any stat category *(requires account)*
- **Playoffs** — playoff bracket simulator *(requires account)*

### Accounts & Personalization
- Sign up and log in via **Supabase Auth** (email + password)
- Save a **favorite team** — auto-preselected in Team Search, starred in Live tab
- **My Team** shortcut on the Account page opens your team's full stats view
- Change email and password through Supabase
- Personal settings (default season preference)
- Guests can browse all public analytics without an account

## Tech Stack

**Frontend**
- React + Vite
- Supabase JS client (auth)
- Lucide icons

**Backend**
- FastAPI (Python)
- SQLAlchemy + PostgreSQL
- scikit-learn (win probability model)
- nba_api (NBA data)
- python-jose (JWT verification)
- slowapi (rate limiting)

**Auth**
- Supabase Auth — identity, sessions, email/password management
- PostgreSQL — user profiles, favorite team, settings

## Local Development

### Prerequisites
- Python 3.11+
- Node 20+
- PostgreSQL
- A [Supabase](https://supabase.com) project

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/statstream_db
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=http://localhost:5173
```

```bash
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm run dev
```

### Tests

```bash
cd backend
pytest -v
```

## Deployment

The project includes a `render.yaml` Blueprint for one-click deployment on [Render](https://render.com).

**Services:**
- `statstream-db` — Render PostgreSQL
- `statstream-backend` — Python web service (FastAPI)
- `statstream-frontend` — Static site (React/Vite)

**Required environment variables for the backend service:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Auto-injected by Render from `statstream-db` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_JWT_SECRET` | Your Supabase JWT secret |
| `ALLOWED_ORIGINS` | Frontend URL (e.g. `https://statstream-frontend.onrender.com`) |

**Required environment variables for the frontend service:**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL assigned by Render |

## Project Structure

```
StatStream/
├── backend/
│   ├── main.py               # FastAPI app, routes
│   ├── models.py             # SQLAlchemy models
│   ├── schemas.py            # Pydantic schemas
│   ├── database.py           # DB connection
│   ├── dependencies/
│   │   └── auth.py           # JWT auth dependency
│   ├── routers/
│   │   └── account.py        # /account/* endpoints
│   ├── services/
│   │   └── account_service.py
│   ├── tests/                # pytest test suite (166 tests)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── lib/
│       │   └── supabaseClient.js
│       └── components/
│           ├── Account.jsx
│           ├── AuthGate.jsx
│           ├── LoginForm.jsx
│           ├── SignupForm.jsx
│           ├── AccountSettings.jsx
│           ├── MyTeamCard.jsx
│           ├── LiveWinProbability.jsx
│           ├── PlayerSearch.jsx
│           └── TeamDashboard.jsx
├── render.yaml               # Render deployment blueprint
└── docker-compose.yml        # Docker Compose (self-hosted)
```
