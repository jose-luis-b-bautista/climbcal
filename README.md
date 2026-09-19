# climbcal 🧗

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
- **Add / edit / delete session** — date, gym (seeded dropdown or free-text "Other"), start/end
  time, optional note. Multiple sessions per day are allowed.
- **Friends** — search by username, send/accept/decline requests, cancel, unfriend.
- **Public feed** — the next ~3 weeks of sessions from climbers whose profile is public.
- **Settings** — edit profile, flip public/private, manage the shared gym list.

Out of scope for v1: notifications, chat, maps, recurring sessions, comments, native apps.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. **Apply the schema.** Either:
   - **Dashboard → SQL Editor → New query**: paste
     [`supabase/migrations/20260919000000_init.sql`](supabase/migrations/20260919000000_init.sql),
     run it, then paste and run
     [`supabase/migrations/20260919000100_seed_gyms.sql`](supabase/migrations/20260919000100_seed_gyms.sql).
   - or use the CLI:
     ```bash
     supabase link --project-ref <your-project-ref>
     supabase db push
     ```
   Both files are idempotent, so re-running is safe.
3. **Auth → Providers → Email**: keep Email enabled. Decide about "Confirm email":
   - ON (default): new users must click the link in the email before signing in. The app shows a
     "check your inbox" notice.
   - OFF: sign-up logs the user straight in (handy while testing).
4. **Auth → URL Configuration**: set *Site URL* to your deployed URL (e.g.
   `https://climbcal.vercel.app`) and add `http://localhost:5173` to *Redirect URLs*.
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

> The anon key is meant to live in the browser — it is protected by RLS. Never put the
> `service_role` key in a Vite env var: everything prefixed with `VITE_` ships to users.

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
   for Production *and* Preview. Redeploy after adding them.
4. `vercel.json` rewrites every path to `index.html` so client-side routes such as `/friends`
   work on refresh.
5. Go back to Supabase → Auth → URL Configuration and set the Site URL to the Vercel domain.

## Data model

```
auth.users ──1:1── profiles (username, display_name, visibility[public|private])
auth.users ──1:n── climbs   (climb_date, start_time, end_time, gym_id | custom_gym_name, note)
gyms                        (seeded list + user-created rows, created_by)
auth.users ──n:n── friendships (requester_id, addressee_id, status[pending|accepted])
```

- One `friendships` row per pair: a unique index on `(least(requester_id, addressee_id),
  greatest(requester_id, addressee_id))` makes an A→B / B→A duplicate impossible.
- `climbs` checks `end_time > start_time` and requires either a `gym_id` or a `custom_gym_name`.
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
                SessionFormModal, ui.tsx (shared primitives + class tokens)
  hooks/        useAuth (session + profile context), useWeekClimbs (range queries),
                useFriends, useGyms
  lib/          supabase (client), date (week math, formatting), format (names/usernames)
  pages/        Login, Onboarding, Week, Friends, Feed, Settings
  test/         Supabase client mock + fixtures for the integration render test
supabase/
  migrations/   init: schema + RLS + triggers, seed_gyms: starter gym list
  config.toml   minimal CLI config (link / db push)
```

Queries work in two steps: load the accepted friend ids, then fetch climbs for `self + friends`
in the selected week (embedded gym name included) and map the climber profiles onto the rows. The
feed reuses the same hook with no user filter, letting RLS return the visible rows and keeping
only `visibility = 'public'` profiles.

## Testing notes

`npm test` covers the date/format helpers plus one integration render of the week view against a
mocked Supabase client (`src/test/`), which verifies the auth gate, friend lookup, climb query
and gym join end to end. The SQL was validated against a local Postgres with a stubbed `auth`
schema: signup trigger, check constraints, per-visibility read rules, the one-row-per-pair
constraint, "only the addressee accepts", and the denial of `anon` access.

Renaming gyms: edit the seed file or the rows themselves; sessions keep working because a deleted
gym falls back to the session's own name text.
