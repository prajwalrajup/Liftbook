# Liftbook — Build Context

Personal workout tracker. Single user, auth needed for just one user just to block open internet traffic. Vue 3 + Neon Postgres (Data API), deployed as a static site, used as a PWA on a Pixel 9 in Firefox.

## Tech stack

- Vue 3 (Composition API, `<script setup>`), Vite as build tool
- Vue Router for the few views (Today / Routines / Calendar / History)
- Pinia for state (routine data, active workout session state)
- Neon Postgres via Neon Data API (PostgREST-compatible HTTP calls, `@neondatabase/neon-js` client) — no backend server, called directly from the browser
- Single user, auth needed for just one user just to block open internet traffic
- Plain CSS (or a lightweight utility approach) — dark theme only, no light mode toggle needed
- Vite PWA plugin (`vite-plugin-pwa`) for manifest + basic offline caching of static assets (not offline data sync)
- Static build output deployed to GitHub Pages or Cloudflare Pages (free)

## Design target

- Design and test at 412 × 915 CSS px (Pixel 9 viewport in Firefox Android), portrait only
- Dark theme: near-black background (not pure `#000`), high-contrast text, one accent color for primary actions/active states
- Generous tap targets (min 44px)
- Bottom tab bar navigation (Today / Routines / Calendar / History)

## Data model

```sql
create table exercises (
  id text primary key,
  name text not null,
  type text not null check (type in ('strength','cardio','yoga','custom')),
  primary_muscles text[],
  equipment text,
  instructions text,
  source text default 'custom'
);

create table routines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rest_between_sets_seconds int not null default 90
);

create table routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid references routines(id) on delete cascade,
  exercise_id text references exercises(id),
  position int not null,
  target_sets int,
  target_reps text,
  rest_seconds int
);

create table weekly_schedule (
  day_of_week int primary key check (day_of_week between 0 and 6),
  routine_id uuid references routines(id),
  is_rest_day boolean not null default false
);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid references routines(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table logged_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references workout_sessions(id) on delete cascade,
  exercise_id text references exercises(id),
  set_number int not null,
  drop_number int not null default 0,
  weight numeric,
  reps int,
  logged_at timestamptz not null default now()
);
```

A drop set is logged as multiple `logged_sets` rows sharing the same `set_number` with increasing `drop_number`.

## Build stages

1. ✅ Skeleton Vite + Vue 3 project scaffold, Vue Router with 4 empty tab views, dark theme, PWA manifest
2. Neon Data API connection + test view
3. Exercise library (import free-exercise-db, browse/filter UI, custom exercise form)
4. Routine builder CRUD
5. Calendar — assign routines to weekdays; Today view
6. Active workout + rest timer
7. History — past sessions, per-exercise trends
