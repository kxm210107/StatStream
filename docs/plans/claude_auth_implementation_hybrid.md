# Claude Implementation Plan — StatStream Auth (Hybrid Setup)

## Goal
Implement account support for StatStream using this architecture:

- Supabase Auth for signup, login, logout, sessions, email/password changes
- Existing FastAPI + PostgreSQL app database for `user_profiles`, `user_settings`, favorite team, and app personalization

Keep the analytics dashboard usable for guests.

Build:
- signup
- login
- logout
- Account tab
- change email
- change password
- one favorite team per user
- personal settings
- My Team shortcut in Account
- favorite team integration in Team Search and Live tab

Keep the implementation modular and low-risk.

---

## Core Architecture Rules
- Do not migrate analytics data into Supabase
- Do not replace the existing Postgres app DB
- Do not build custom password auth in FastAPI
- Use Supabase only for identity/session management
- Use current SQLAlchemy/Postgres for app-owned user data

---

## Product Decisions
- Auth provider: Supabase Auth
- Guest access: allowed
- Login entry point: Account tab
- Session target: 7 days
- Roles: none
- Favorite teams: exactly one for V1
- Backend organization: use routers/services/dependencies instead of bloating `main.py`

---

## Recommended File Structure

### Backend
Existing:
- `backend/main.py`
- `backend/models.py`
- `backend/schemas.py`
- `backend/database.py`

New:
- `backend/routers/account.py`
- `backend/services/auth_provider.py`
- `backend/services/account_service.py`
- `backend/dependencies/auth.py`

Optional:
- migrations for new tables

### Frontend
Existing:
- `src/App.jsx`
- `src/api.js`

New:
- `src/components/Account.jsx`
- `src/components/LoginForm.jsx`
- `src/components/SignupForm.jsx`
- `src/components/AccountSettings.jsx`
- `src/components/MyTeamCard.jsx`
- `src/context/AuthContext.jsx`
- `src/lib/supabaseClient.js`

---

## Database Changes (Current PostgreSQL App DB)

### Add table: `user_profiles`
Suggested columns:
- `id`
- `auth_user_id` (Supabase user id, unique, indexed)
- `email`
- `favorite_team_abbr` (nullable)
- `created_at`
- `updated_at`

### Add table: `user_settings`
Suggested columns:
- `id`
- `auth_user_id` (unique, indexed)
- `default_season` (nullable)
- `settings_json` (nullable) or explicit simple columns
- `created_at`
- `updated_at`

### Notes
- Keep indexes on `auth_user_id`
- Keep user-specific reads narrow
- Do not join these tables into heavy analytics queries unless required
- The app DB remains the source of truth for personalization

---

## Backend Responsibilities

### `backend/services/auth_provider.py`
Responsibilities:
- verify Supabase JWT / access token
- extract authenticated Supabase user identity
- normalize payload to app-friendly auth identity

Expected output:
- `auth_user_id`
- `email`

### `backend/dependencies/auth.py`
Responsibilities:
- reusable FastAPI dependency for protected routes
- read bearer token from request
- validate token with Supabase/JWKS or provider verification logic
- return normalized authenticated identity

### `backend/services/account_service.py`
Responsibilities:
- get or create `user_profiles` row from authenticated Supabase identity
- get or create `user_settings` row
- update favorite team
- get/update settings
- ensure only current user data is modified

### `backend/routers/account.py`
Responsibilities:
- expose app-owned account endpoints
- all routes protected by auth dependency

Suggested routes:
- `GET /account/me`
- `PATCH /account/favorite-team`
- `GET /account/settings`
- `PATCH /account/settings`

Keep these routes small and user-specific.

---

## Backend Schema Additions

Add to `backend/schemas.py`:
- `AccountProfileOut`
- `FavoriteTeamUpdate`
- `UserSettingsOut`
- `UserSettingsUpdate`

### Suggested response shapes

#### `GET /account/me`
```json
{
  "email": "user@example.com",
  "favorite_team_abbr": "ATL",
  "created_at": "2026-03-10T10:00:00Z"
}
```

#### `PATCH /account/favorite-team`
Request:
```json
{
  "favorite_team_abbr": "ATL"
}
```

Response:
```json
{
  "favorite_team_abbr": "ATL"
}
```

#### `GET /account/settings`
```json
{
  "default_season": "2025-26",
  "settings": {}
}
```

#### `PATCH /account/settings`
```json
{
  "default_season": "2025-26",
  "settings": {}
}
```

Keep responses simple.

---

## Frontend Responsibilities

### `src/lib/supabaseClient.js`
Responsibilities:
- initialize Supabase client
- expose auth helpers:
  - signup
  - login
  - logout
  - get current session
  - change email
  - change password

### `src/context/AuthContext.jsx`
Responsibilities:
- track current Supabase session
- track current auth user
- expose:
  - `signup`
  - `login`
  - `logout`
  - `refreshSession`
  - `changeEmail`
  - `changePassword`
- restore session on app load

### `src/components/Account.jsx`
Responsibilities:
- render guest view or logged-in view
- guest view:
  - login form
  - signup form or toggle
- logged-in view:
  - profile summary
  - favorite team editor
  - settings editor
  - My Team shortcut
  - account actions

### `src/components/LoginForm.jsx`
- email/password login via Supabase

### `src/components/SignupForm.jsx`
- email/password signup via Supabase

### `src/components/AccountSettings.jsx`
- settings form
- change email
- change password

### `src/components/MyTeamCard.jsx`
- display saved favorite team
- “Open My Team” action

---

## Frontend API Additions

Update `src/api.js` with helpers for app-owned data:
- `getAccountProfile(token)`
- `updateFavoriteTeam(token, favoriteTeamAbbr)`
- `getAccountSettings(token)`
- `updateAccountSettings(token, payload)`

Rules:
- use Supabase session access token for authenticated backend requests
- keep auth state in `AuthContext`, not `api.js`

---

## UI Integration Requirements

### App navigation
Add Account as a tab in `App.jsx`.

### Guest state
If not authenticated:
- show login/signup in Account tab
- do not block any existing public analytics tabs

### Logged-in state
If authenticated:
- Account tab shows:
  - email
  - favorite team section
  - settings section
  - change password
  - change email
  - logout
  - My Team shortcut

### Team Search integration
If favorite team exists:
- preselect or prioritize saved team in Team Search
- allow user to browse any other team normally

### Live tab integration
If favorite team exists:
- add a star icon next to games involving that team
- optionally sort those games higher if that improves UX

### My Team integration
If favorite team exists:
- clicking My Team should open the same team-level experience currently provided by Team Search
- reuse current team dashboard/search logic instead of duplicating analytics UI

---

## Recommended Phases

### Phase 1 — Scaffolding
Goal:
- add DB tables
- add backend schemas, services, dependency, and router stubs
- add Supabase client on frontend
- add Account tab and placeholder UI
- add AuthContext

Done when:
- app has Account tab
- DB has `user_profiles` and `user_settings`
- backend has route stubs
- frontend can render guest vs logged-in placeholder states

### Phase 2 — Supabase Auth Flow
Goal:
- implement signup/login/logout
- restore session on refresh
- support session-aware Account UI

Tasks:
- wire Supabase client
- implement `AuthContext`
- implement login/signup forms
- implement logout
- implement session bootstrap on app load

Done when:
- user can sign up
- user can log in
- user stays logged in across refresh
- guest access still works normally

### Phase 3 — App Profile + Favorite Team
Goal:
- connect authenticated Supabase user to app-owned DB rows
- support favorite team persistence

Tasks:
- implement `GET /account/me`
- implement `PATCH /account/favorite-team`
- create/get profile row on first authenticated access
- add favorite team picker in Account tab

Done when:
- logged-in user can save favorite team
- favorite team persists in current Postgres DB
- Account page reflects saved team

### Phase 4 — Settings + Account Actions
Goal:
- support app settings plus email/password change flows

Tasks:
- implement settings endpoints
- implement settings form
- wire change email via Supabase
- wire change password via Supabase

Done when:
- user can update email
- user can update password
- settings save and load correctly

### Phase 5 — Dashboard Personalization
Goal:
- apply favorite team throughout the app

Tasks:
- Team Search defaults/prioritizes favorite team
- Live tab stars favorite team games
- team lists place favorite team at top where appropriate
- Account page My Team shortcut opens team detail/search flow

Done when:
- favorite team is visible across the product
- personalization works without impacting guest browsing

### Phase 6 — Polish
Goal:
- stabilize and clean up

Tasks:
- loading/error states
- empty states
- session expiry handling
- graceful Supabase failure handling
- test auth edge cases

Done when:
- feature feels stable and demo-ready

---

## Security Rules
- do not store passwords in app DB
- do not implement custom password hashing/auth flows in FastAPI
- validate Supabase token on protected backend endpoints
- scope all account endpoints to current authenticated user only
- keep Supabase keys/secrets in env vars
- never expose another user’s profile or settings
- keep public analytics routes public unless intentionally changed

---

## Performance Rules
- do not couple account fetches to heavy analytics endpoints
- keep profile/settings tables small and indexed
- fetch personalization separately and apply in frontend where practical
- avoid expensive joins in live/team analytics endpoints just to personalize minor UI behavior
- preserve current analytics performance characteristics

---

## Edge Cases
- unauthenticated user opens Account tab -> show login/signup
- authenticated user with no favorite team -> show picker prompt
- expired Supabase session -> clear local auth state and return to guest mode
- Supabase unavailable -> keep public dashboard usable; show non-blocking account error
- favorite team removed or invalid -> prompt reselection

---

## Definition of Done
The feature is complete when:
- Account tab exists
- users can sign up and log in through Supabase
- users can log out
- users can change email
- users can change password
- users can save one favorite team
- favorite team affects Team Search and Live tab behavior
- Account tab includes My Team and settings
- guest users can still use the dashboard without logging in
- app personalization is stored in the current PostgreSQL app DB

---

## Resume Target
This implementation should support a resume bullet like:

Added account management and personalization to a full-stack NBA analytics dashboard using Supabase Auth for identity management and PostgreSQL-backed user profile tables for app-specific settings and favorite-team personalization.

---

## What Claude Should Do First
1. Add the new SQLAlchemy models/tables in the current app DB.
2. Add backend schemas.
3. Create backend auth dependency, account service, and account router.
4. Add Supabase client wiring on the frontend.
5. Create `AuthContext`.
6. Build Account tab UI with guest and logged-in states.
7. Implement favorite team persistence in the current Postgres DB.
8. Integrate favorite team into Team Search and Live tab.
9. Add change email/password flows through Supabase.
10. Polish loading, empty, and error states.

Keep changes incremental, modular, and readable.
