# StatStream Auth — Design Spec

**Date:** 2026-03-10
**Status:** Approved

---

## Overview

Add account support to StatStream using a hybrid auth architecture:
- **Supabase Auth** owns identity (signup, login, logout, sessions, email/password change)
- **Existing PostgreSQL** owns app data (user profiles, settings, favorite team)
- **FastAPI backend** validates Supabase JWTs and enforces user-scoped data access
- **React frontend** holds auth state in AuthContext, passes tokens to backend

Guest access remains fully functional. Team Comparer and Playoff Simulator tabs are restricted to logged-in users.

---

## Architecture

### Identity vs App Data Split

| Concern | Owner |
|---------|-------|
| Signup / login / logout | Supabase Auth |
| Session tokens | Supabase Auth |
| Password / email change | Supabase Auth |
| user_profiles | PostgreSQL (existing app DB) |
| user_settings | PostgreSQL (existing app DB) |
| Favorite team | PostgreSQL (existing app DB) |

### Subagent Execution Waves

| Wave | Parallelism | Scope |
|------|-------------|-------|
| 1 | Sequential | Supabase project setup, DB tables, backend scaffolding, frontend scaffolding |
| 2 | 2 parallel | Backend: JWT dependency + account router / Frontend: AuthContext + Supabase client |
| 3 | 2 parallel | Backend: profile/settings endpoints / Frontend: Account tab + auth-gated tabs |
| 4 | 2 parallel | Backend: settings endpoints / Frontend: favorite team integration + dashboard personalization |
| 5 | Sequential | Polish: loading states, error states, session expiry, edge cases |

---

## Security Design

### Supabase Configuration
- Email confirmation: disabled (immediate activation)
- Access token expiry: 1 hour
- Refresh token expiry: 7 days
- RLS enabled by default on all Supabase tables

### JWT Verification
- Backend verifies Supabase JWT using `python-jose[cryptography]` + Supabase JWT secret
- Offline verification — no round-trip to Supabase per request
- `get_current_user` FastAPI dependency extracts `auth_user_id` and `email` from verified token

### User Data Isolation
- All `/account/*` endpoints require valid Bearer token
- Every DB query filters by `auth_user_id` from the verified token
- No user can read or write another user's data

### Environment Variables
- Backend: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Service role key never exposed to frontend

---

## Backend Changes

### New DB Models (added to `models.py`)

**UserProfile**
- `id` (pk)
- `auth_user_id` (unique, indexed)
- `email`
- `favorite_team_abbr` (nullable)
- `created_at`, `updated_at`

**UserSettings**
- `id` (pk)
- `auth_user_id` (unique, indexed)
- `default_season` (nullable)
- `settings_json` (nullable JSON)
- `created_at`, `updated_at`

### New Files

| File | Purpose |
|------|---------|
| `backend/dependencies/auth.py` | `get_current_user` dependency — verify JWT, return auth identity |
| `backend/services/account_service.py` | get-or-create profile/settings, update favorite team, update settings |
| `backend/routers/account.py` | Protected account routes |

### New Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/account/me` | Get profile (get-or-create on first call) |
| PATCH | `/account/favorite-team` | Update favorite team |
| GET | `/account/settings` | Get settings |
| PATCH | `/account/settings` | Update settings |

### Modified Files

| File | Change |
|------|--------|
| `models.py` | Add UserProfile, UserSettings |
| `schemas.py` | Add AccountProfileOut, FavoriteTeamUpdate, UserSettingsOut, UserSettingsUpdate |
| `main.py` | Include account router, load SUPABASE_JWT_SECRET |
| `requirements.txt` | Add python-jose[cryptography] |

---

## Frontend Changes

### New Files

| File | Purpose |
|------|---------|
| `src/lib/supabaseClient.js` | Supabase JS client initialized with env vars |
| `src/context/AuthContext.jsx` | Session state, signup/login/logout/changeEmail/changePassword, session restore on load |
| `src/components/Account.jsx` | Guest view (login+signup) or logged-in view (profile, favorite team, settings, My Team) |
| `src/components/LoginForm.jsx` | Email/password login form |
| `src/components/SignupForm.jsx` | Email/password signup form |
| `src/components/AccountSettings.jsx` | Change email, change password, default season |
| `src/components/MyTeamCard.jsx` | Show favorite team, "Open My Team" button |

### Modified Files

| File | Change |
|------|--------|
| `src/api.js` | Add getAccountProfile, updateFavoriteTeam, getAccountSettings, updateAccountSettings |
| `src/App.jsx` | Wrap in AuthProvider, add Account tab, pass favoriteTeam to PlayerSearch + LiveWinProbability |
| `src/components/PlayerSearch.jsx` | Preselect favorite team if set |
| `src/components/LiveWinProbability.jsx` | Star games involving favorite team |

### Auth-Gated Tabs (Team Comparer + Playoffs)

- Tab remains visible in nav for guests
- Clicking while unauthenticated renders a centered sign-in wall: brief message + LoginForm + toggle to SignupForm
- Clicking while authenticated renders the normal tab content

---

## Edge Cases

- Guest opens Account tab → sees login/signup UI
- Logged-in user has no favorite team → shown picker prompt
- Supabase session expires → app clears auth state, returns to guest mode, prompts re-login
- Supabase unavailable → non-blocking error in Account tab; public dashboard stays usable
- Favorite team abbr no longer valid → prompt reselection

---

## Success Criteria

- Guests can still browse all public tabs normally
- Team Comparer and Playoff Simulator show sign-in wall to guests
- Users can sign up, log in, stay logged in across refresh
- Users can change email and password via Supabase
- Users can save one favorite team persisted in PostgreSQL
- Favorite team prefills Team Search and stars Live tab games
- Account tab shows My Team shortcut, settings, profile, and auth actions
- No performance regression on public analytics endpoints
