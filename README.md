# climbcal 🧗

[![CI](https://github.com/jose-luis-b-bautista/climbcal/actions/workflows/ci.yml/badge.svg)](https://github.com/jose-luis-b-bautista/climbcal/actions/workflows/ci.yml)

A small web app for answering one question: **who is climbing, where, and when — this week?**

Open the week view, see your friends' sessions as cards (name, gym, time window), and add your
own. Profiles are public or private: private schedules are only visible to accepted friends,
public profiles additionally appear on a public climbers feed. Built for a friend group
(~50–75 users) entirely on free tiers.

## Stack

| Layer    | Choice                                                       |
| -------- | ------------------------------------------------------------ |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 + React Router |
| Backend  | Supabase (Auth + Postgres + Row Level Security) — no server  |
| Hosting  | Vercel (Hobby) for the static build                          |
| Tests    | Vitest + Testing Library (jsdom)                             |

There is no custom backend: the browser talks to Supabase directly and **RLS** enforces who may
read or write what.

## Features

- **Auth** — email + password (Supabase Auth).
- **Onboarding** — pick a username, display name, and profile visibility (defaults to private).
- **Week view** (home) — Mon–Sun of any week (prev / this week / next), with `?week=YYYY-MM-DD`
  in the URL so weeks are linkable. Each day shows a count of friends climbing plus session
  cards; your own sessions are highlighted and editable.
- **Add / edit / delete session** — date, gym (dropdown grouped by region — Luzon / Visayas /
  Mindanao — or free-text "Other"), a time window (exact clock times **or** flexible labels such as
  "Opening" / "Before Dinner" / "Closing"), optional note. Multiple sessions per day are allowed.
- **Friends** — search by username, send/accept/decline requests, cancel, unfriend.
- **Public feed** — the next ~3 weeks of sessions from climbers whose profile is public.
- **Settings** — edit profile, flip public/private, manage the shared gym list.
- **Light / dark mode** — a toggle in the header (and on the auth screens) that remembers your
  choice per browser and falls back to your OS setting. No flash on load: a tiny inline script in
  `index.html` sets the theme before first paint.

Out of scope for v1: notifications, chat, maps, recurring sessions, comments, native apps.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. **Apply the schema.** Either:
   - **Dashboard → SQL Editor → New query**: run every file under `supabase/migrations/` in
     filename order — [`20260919000000_init.sql`](supabase/migrations/20260919000000_init.sql)
     (schema + RLS), [`20260919000100_seed_gyms.sql`](supabase/migrations/20260919000100_seed_gyms.sql)
     and [`20260920000000_gym_regions.sql`](supabase/migrations/20260920000000_gym_regions.sql) (the
     gym list, tagged by region), then
     [`20260920000100_session_windows.sql`](supabase/migrations/20260920000100_session_windows.sql)
     (flexible time-of-day windows).
   - or use the CLI (verified end to end with CLI v2.117; no Docker needed):
     ```bash
     npx supabase@latest login          # opens the browser once
     npx supabase@latest link --project-ref <your-project-ref>
     npx supabase@latest db push        # asks for your DB password if not linked with -p
     npx supabase@latest migration list --linked   # local vs remote should match
     ```
     `db push` applies the files in `supabase/migrations/` in filename order and records them in
     `supabase_migrations.schema_migrations`, so re-running it prints *"Remote database is up to
     date."* — safe to repeat. Use `--dry-run` to preview and `--include-seed` only if you later
     add a `seed.sql`.
   All four files are idempotent, so re-running is safe.
   > Already set the project up earlier? Just run the migrations you haven't:
   > `20260920000000_gym_regions.sql` adds the `region` column, retires the old placeholder gyms
   > (keeping sessions that referenced them as free-text names) and seeds the regional list;
   > `20260920000100_session_windows.sql` adds the flexible `start_slot` / `end_slot` windows and
   > leaves existing clock-time sessions untouched. Running `db push` does both for you.
3. **Auth → Providers → Email**: keep Email enabled. Decide about "Confirm email":
   - ON (default): new users must click the link in the email before signing in. The app shows a
     "check your inbox" notice.
   - OFF: sign-up logs the user straight in (handy while testing).
4. **Auth → URL Configuration**: set *Site URL* to your deployed URL (e.g.
   `https://climbcal.vercel.app`) and add `http://localhost:5173` to *Redirect URLs*.
5. **Settings → API Keys**: copy the **Project URL** and the **publishable key**
   (`sb_publishable_…`). That pair is what a browser app uses. The *secret* key (`sb_secret_…`)
   and the legacy `service_role` key bypass RLS and must never reach the frontend. Supabase is
   deprecating the legacy `anon` / `service_role` keys by the end of 2026 — if your project still
   only shows the legacy keys, the `anon` key works in exactly the same slot.

> The var is named `VITE_SUPABASE_ANON_KEY` for historical reasons; paste the **publishable** key
> there (a legacy anon key also still works — verified identical handling in supabase-js 2.116).
> Everything prefixed with `VITE_` ships to users, so a secret key must never appear in it.

## 2. Run locally

```bash
npm install
cp .env.example .env.local     # then paste your two Supabase values
npm run dev                    # http://localhost:5173
```

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are read from `.env.local` (gitignored). If they
are missing, the app renders a setup screen instead of failing with opaque network errors.

Other scripts:

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the built output
npm test           # Vitest suite
npm run lint       # oxlint
```

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repository. The Vite preset is detected
   automatically (`npm run build`, output `dist/`).
3. **Settings → Environment Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (the Project URL + publishable key) for Production *and* Preview. Redeploy after adding them.
4. `vercel.json` rewrites every path to `index.html` so client-side routes such as `/friends`
   work on refresh.
5. Go back to Supabase → Auth → URL Configuration and set the Site URL to the Vercel domain.

## Data model

```
auth.users ──1:1── profiles (username, display_name, visibility[public|private])
auth.users ──1:n── climbs   (climb_date, start_time | start_slot, end_time | end_slot,
                             gym_id | custom_gym_name, note)
gyms                        (name, city, region, seeded list + user-created rows, created_by)
auth.users ──n:n── friendships (requester_id, addressee_id, status[pending|accepted])
```

- One `friendships` row per pair: a unique index on `(least(requester_id, addressee_id),
  greatest(requester_id, addressee_id))` makes an A→B / B→A duplicate impossible.
- `climbs` requires either a `gym_id` or a `custom_gym_name`, and its window is **either** two
  clock times (`start_time` / `end_time`) **or** two time-of-day labels (`start_slot` /
  `end_slot`, one of the eight in `src/lib/slots.ts`). `public.window_minutes()` puts both forms on
  one canonical scale, so a single constraint can insist the end comes after the start — mixed
  windows such as `Opening → 21:00` included. The scale is never displayed: labels are shown
  verbatim, and a duration appears only when both ends are clock times.
- `gyms.region` is free text (`Luzon` / `Visayas` / `Mindanao` for the seeded list): the session
  dropdown and the Settings list are grouped by it, with an "Other" bucket for untagged gyms.
- Signing up creates the `profiles` row automatically (`on_auth_user_created` trigger).
- `updated_at` is maintained by triggers.

### Visibility rules (enforced by RLS, not by the client)

| Table         | Read                                                               | Write                                                                                  |
| ------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `profiles`    | any signed-in user (needed for username search + feed attribution)  | owner only                                                                             |
| `gyms`        | any signed-in user                                                  | creator (insert/update/delete)                                                          |
| `climbs`      | owner, **accepted friends**, or everyone when the owner is `public` | owner only                                                                             |
| `friendships` | only the two participants                                           | insert self as requester; **only the addressee can accept**; either side can delete      |

Nothing is granted to the `anon` role, so there is no anonymous browsing: every surface except
`/login` requires a session.

## Project layout

```
src/
  components/   Layout (nav shell), ProtectedRoute (session/onboarding gates),
                SessionFormModal, ThemeToggle, ui.tsx (shared primitives + class tokens)
  hooks/        useAuth (session + profile context), useTheme (light/dark),
                useWeekClimbs (range queries), useFriends, useGyms
  lib/          supabase (client), date (week math, window helpers),
                format (names/usernames, gym-by-region grouping),
                slots (the eight time-of-day window labels)
  pages/        Login, Onboarding, Week, Friends, Feed, Settings
  test/         Supabase client mock + fixtures for the integration render test
supabase/
  migrations/   init: schema + RLS + triggers, seed_gyms: placeholder starter list,
                gym_regions: real gym list grouped by region,
                session_windows: flexible window columns + constraints
  config.toml   minimal CLI config (link / db push)
```

Queries work in two steps: load the accepted friend ids, then fetch climbs for `self + friends`
in the selected week (embedded gym name included) and map the climber profiles onto the rows. The
feed reuses the same hook with no user filter, letting RLS return the visible rows and keeping
only `visibility = 'public'` profiles.

## Theming

The components are written **dark-first** against the Tailwind scales: `zinc-950` is the page
background, `zinc-900` a card, `zinc-800` a border, `zinc-100` primary text, `zinc-400/500` muted
text, and `emerald` is the accent with `red`/`sky` for danger and info surfaces.

Instead of duplicating `dark:` variants everywhere, [`src/index.css`](src/index.css) redefines those
same tokens for the light theme, so every existing class keeps its *role* in both themes (surface
shades become light, text shades become dark). `ThemeProvider` toggles a `.dark` class on `<html>`,
which is what the token overrides and any future `dark:` utilities key off.

Practical consequences when editing UI:

- Keep using the existing scales rather than raw hex values, or a colour will not adapt.
- Light-theme values are checked for contrast by `src/theme.test.ts` — it parses the tokens out of
  the CSS and asserts WCAG AA (4.5:1) for body text, and perceivable borders. Change a colour and
  the test tells you if it broke.

## Testing notes

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm test` and `npm run build` on every push
to `main` and on pull requests — no secrets required.

`npm test` covers the date/format helpers plus one integration render of the week view against a
mocked Supabase client (`src/test/`), which verifies the auth gate, friend lookup, climb query
and gym join end to end. The SQL was validated against a local Postgres with a stubbed `auth`
schema: signup trigger, check constraints, per-visibility read rules, the one-row-per-pair
constraint, "only the addressee accepts", and the denial of `anon` access.

Renaming gyms: edit the seed file or the rows themselves; sessions keep working because a deleted
gym falls back to the session's own name text.
