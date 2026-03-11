# StatStream Auth PRD — Hybrid Setup

## Objective
Add account support to StatStream using a hybrid architecture:

- Supabase Auth for identity, signup/login, session handling, email/password management
- Existing FastAPI + PostgreSQL app database for app-specific user data

The dashboard must remain usable for guests.

This feature should enable:
- signup
- login
- logout
- change email
- change password
- account page
- saved favorite team
- personal settings
- a “My Team” experience tied to the saved favorite team

This should be modular, lightweight, and low-risk for the current codebase.

---

## Architecture Decision
Use Supabase for auth only, not as the main app database.

### Reasoning
This is the best balance of:
- real-world architecture
- resume value
- lowest risk of breaking the current app

### Identity vs app data split
- Supabase Auth owns:
  - signup
  - login
  - logout
  - sessions
  - password handling
  - email change / password change flows
- Current Postgres DB owns:
  - `user_profiles`
  - `user_settings`
  - favorite team
  - app personalization

### Source of truth
- Auth identity source of truth: Supabase
- App data source of truth: existing PostgreSQL via SQLAlchemy

---

## Product Decisions
- Auth approach: Supabase Auth only
- Signup: Yes
- Login UI: Account tab
- Guest access: Allowed
- Session target: 7 days
- Password change: Supported via Supabase
- Email change: Supported via Supabase
- Roles: None
- Favorite teams: One team for V1
- Backend structure: Add routers/services/dependencies instead of growing `main.py`

---

## Primary User Value
Accounts should personalize the dashboard without gating the analytics experience.

Logged-in users should be able to:
- save one favorite team
- see that team automatically appear in Team Search
- see that team prioritized across relevant lists
- see a star next to that team’s games on the Live tab
- open an Account page with “My Team” and settings
- click “My Team” and view the same experience currently shown in Team Search, scoped to the saved team

Guests should still be able to:
- browse teams
- browse analytics
- use the live tab
- use the dashboard normally without logging in

---

## MVP Scope

### In scope
- signup
- login
- logout
- account page
- change email
- change password
- persist one favorite team per user
- persist personal settings
- prioritize favorite team in relevant UI lists
- star favorite team games on live views
- add a “My Team” section in Account that opens the same team detail/search experience for the saved team

### Out of scope
- multiple favorite teams
- admin roles
- paid tiers
- social features
- saved custom dashboards in V1
- migrating analytics data into Supabase

---

## User Stories

### Authentication
- As a new user, I want to sign up so I can personalize the dashboard.
- As a returning user, I want to log in so I can access my saved preferences.
- As a logged-in user, I want to log out securely.
- As a logged-in user, I want to change my email.
- As a logged-in user, I want to change my password.

### Favorite team
- As a logged-in user, I want to save one favorite team.
- As a logged-in user, I want my favorite team to appear automatically in Team Search.
- As a logged-in user, I want my favorite team’s live games marked with a star.
- As a logged-in user, I want my favorite team to be sorted to the top of team-based lists.

### Account experience
- As a logged-in user, I want an Account page that shows my profile, settings, and My Team.
- As a logged-in user, I want to click My Team and see the same team-level experience available in Team Search.

### Guest experience
- As a guest, I want to keep using the dashboard without creating an account.
- As a guest, I want clear prompts that accounts add personalization rather than block access.

---

## UX Requirements

### Navigation
Add a new Account tab.

### Guest state
The Account tab should show:
- login form
- signup form or toggle
- short explanation of account benefits

### Logged-in state
The Account tab should show:
- profile summary
- email
- account actions:
  - change email
  - change password
  - logout
- favorite team section
- settings section
- My Team entry point

### Favorite team UX
Users can:
- choose one favorite team
- replace their favorite team later
- remove favorite team later if desired

The UI should use the favorite team to:
- prefill / default Team Search
- prioritize team lists
- star live games involving that team

### My Team UX
On Account page:
- show a “My Team” button/card if favorite team exists
- clicking it opens the same data/view pattern used in Team Search
- if no favorite team exists, show an empty state and prompt selection

---

## Functional Requirements

### Auth
The system must support:
- signup with email + password through Supabase
- login with email + password through Supabase
- logout
- session restore on refresh
- change email through Supabase
- change password through Supabase

### Account data
The app database must store:
- Supabase auth user id
- email
- favorite team
- settings

### Favorite team behavior
If a user has a favorite team:
- Team Search should default to that team when practical
- live games involving that team should show a star
- team lists should rank that team first where it makes sense
- Account page should show a My Team shortcut

### Settings
Support a lightweight settings object for V1.
Suggested examples:
- default season
- preferred landing behavior for Account tab
- future UI preferences

---

## Data Model
Use Supabase for auth and the current Postgres app DB for app-owned profile data.

### Recommended tables in existing PostgreSQL DB

#### `user_profiles`
Fields:
- `id` (internal pk)
- `auth_user_id` (Supabase user id, unique, indexed)
- `email`
- `favorite_team_abbr` (nullable)
- `created_at`
- `updated_at`

#### `user_settings`
Fields:
- `id`
- `auth_user_id` (unique or one-to-one, indexed)
- `default_season` (nullable)
- `settings_json` (nullable) or explicit simple columns
- `created_at`
- `updated_at`

### Notes
- Keep these tables small and indexed by `auth_user_id`
- Do not move analytics data into Supabase
- Do not join these tables into heavy analytics queries unless needed
- Pull user preferences separately where practical

---

## Service / API Responsibilities

### Supabase responsibilities
- signup
- login
- logout
- session management
- password reset / password change flow
- email change flow
- secure password storage

### FastAPI backend responsibilities
- validate Supabase JWT/session token for protected routes
- map authenticated Supabase user to internal app profile tables
- expose endpoints for app-owned profile/settings operations

### Suggested backend routes
- `GET /account/me`
- `PATCH /account/favorite-team`
- `GET /account/settings`
- `PATCH /account/settings`

The backend should not implement custom password hashing or custom JWT auth for this feature.

---

## Integration Requirements

### Team Search integration
If favorite team exists:
- default Team Search to that team
- expose a clear indicator that this is the saved team
- still allow changing to any other team

### Live tab integration
If favorite team exists:
- mark games involving that team with a star
- optionally sort those games first if useful

### Team lists / selectors
If a list of teams is shown:
- rank favorite team first where this improves usability
- do not permanently mutate global team ordering in a confusing way

### Account page integration
The Account page should contain:
- profile
- favorite team
- settings
- My Team shortcut

---

## Security Requirements
- do not store passwords in the app DB
- rely on Supabase Auth for password handling
- validate Supabase token/session on protected backend endpoints
- authorize profile/settings operations against the authenticated user only
- avoid exposing other users’ settings or favorite teams
- keep Supabase secrets and keys in environment variables
- log auth errors safely without leaking sensitive details

---

## Performance Requirements
- auth lookups must be isolated from heavy analytics queries
- favorite team retrieval should be indexed and lightweight
- existing public endpoints should remain public
- only user-specific endpoints should require auth validation
- avoid blocking app load on account fetch for guest users
- the hybrid setup must not change analytics query performance

---

## Edge Cases
- guest opens Account tab -> sees login/signup UI
- logged-in user has no favorite team -> sees prompt to choose one
- Supabase session expires -> app returns to guest-like state and prompts re-login
- favorite team no longer resolves cleanly -> show fallback and allow reselection
- Supabase unavailable -> show non-blocking error in Account tab; public dashboard remains usable

---

## Success Criteria
The feature is successful when:
- guests can still browse normally
- users can sign up and log in
- users can change email and password
- users can save one favorite team
- favorite team affects Team Search and Live tab behavior
- Account page shows My Team and settings
- no meaningful performance regression appears in public analytics flows

---

## Resume Narrative
This feature should support a description like:

Added account management and personalization to a full-stack NBA analytics dashboard using Supabase Auth for identity and PostgreSQL-backed user profile tables for app-specific settings and favorite-team personalization.
