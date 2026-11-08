# climbcal 🧗

[![CI](https://github.com/jose-luis-b-bautista/climbcal/actions/workflows/ci.yml/badge.svg)](https://github.com/jose-luis-b-bautista/climbcal/actions/workflows/ci.yml)

A small web app for one question: **who is climbing, where, and when - this week?** Open the week
view, see your friends' sessions as cards (name, gym, time window), and add your own. Profiles are
public or private: private schedules are only visible to accepted friends, public profiles also show
up on a public climbers feed and can be handed out as a share link (`/u/<username>`) that opens even
for someone without an account. Built for a friend group (~50–75 users) entirely on free tiers.

[DESIGN.md](DESIGN.md) is the UI/design guide (theming, colours, component primitives).

## Stack

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Frontend  | React 19 + Vite + TypeScript + Tailwind CSS 4 + React Router  |
| Backend   | Supabase (Auth + Postgres + Row Level Security) - no server   |
| Hosting   | Vercel (Hobby) for the static build                           |
| Analytics | Vercel Web Analytics (`@vercel/analytics`) - cookieless       |
| Tests     | Vitest + Testing Library (jsdom)                              |

There is no custom backend: the browser talks to Supabase directly and **RLS** enforces who may read
or write what.

## Features

- **Auth & onboarding** - email + password; pick a username, display name and visibility (private by
  default).
- **Calendar** (home) - **Today** and **Tomorrow** summary cards on top (with "On now" / "Finished"
  badges), then the **Mon–Sun week** (prev / this / next) at `?week=YYYY-MM-DD`, so weeks are
  linkable. Your own sessions are highlighted and editable. The day cards always describe the *real*
  today and tomorrow and open on arrival.
- **Sessions** - several per day, each with a date, a gym from the curated list (grouped by region)
  or a typed "Other" name, an optional second gym (**"Either X or Y"**) or **"Not sure yet"**, a
  time window (exact clock times **or** labels such as "Opening" / "Closing"), and an optional note.
  Today / Tomorrow quick picks in the dialog.
- **Friends** - the newest public climbers listed ready to add, plus username search; send, accept,
  decline, cancel, unfriend.
- **Feed** - public profiles **plus your own** sessions, in two URL-backed layouts:
  - **List** - the next week grouped by day and then by gym ("who is going where"); today starts
    open, **View all days** expands everything. Two-gym sessions appear under both.
  - **Calendar** - a month of days carrying one avatar dot per climber; tap a day to expand its
    sessions underneath.
- **Stats** - yours, or a friend's from the climber picker (`?climber=<id>`): sessions and active
  days, week streak, usual day, gyms visited, notes written, a 13-week activity heatmap, and a
  "where I climb" region → gym breakdown. Reads `security_invoker` views, so RLS decides what a
  friend's page can show. A session is a posted *plan*, so the page counts days, sessions and places
  - never hours.
- **Settings** - edit profile, flip public/private, share link, send feedback.
- **Share links** - `/u/<username>` renders one week (time and gym only, never notes) for a
  signed-out visitor, with a sign-up link that brings them back to that page.
- **What was updated** - release notes open once per device and cover **everything new since your last
  visit** (a skipped deploy is not lost), re-openable from Settings.
- **Comments and walls** - a flat comment thread on every session ("who is coming?"), and a
  **wall** (guestbook) for every climber at `/wall/<id>`. Session comments are readable by whoever
  may read the session; wall notes by the climber, their friends, or anyone while the profile is
  public - both rules live in RLS, not in the client. The author can delete their own comment, and
  the owner of the session or wall can delete any on it (two taps, so a stray thumb on a phone
  cannot). A collapsed card shows its count from one batched query per page; the thread itself only
  loads when it is opened. The public share page stays text-free.
- **Light / dark mode** - remembered per browser, falls back to the OS, no flash on load.

Out of scope for v1: notifications, chat, maps, recurring sessions, native apps.

## 1. Create the Supabase project

Create a project at [supabase.com](https://supabase.com) (free tier), then apply the schema - paste
every file under `supabase/migrations/` into the SQL editor in filename order, or use the CLI (no
Docker needed):

```bash
npx supabase@latest login                            # opens the browser once
npx supabase@latest link --project-ref <your-project-ref>
npx supabase@latest db push --include-all --remote   # applies pending migrations, safe to repeat
npx supabase@latest migration list --remote          # local vs remote should match
```

Two flags that matter:

- **`--remote`** - CLI v3 pushes to your **local** stack by default; a bare `db push` fails with
  `ECONNREFUSED 127.0.0.1:54322` unless Docker is running.
- **`--include-all`** - `db push` only applies migrations *newer* than the last one on the remote.
  This repo carries `20270912000000_feedback.sql`, which is later than the 2026-11 migrations, so
  without this flag a new 2026-11 file is skipped while the command still exits `0` - the app then
  reports `Could not find the table … in the schema cache`. `migration list --remote` is the check
  that catches it.

| Migration                                     | Adds                                                       |
| --------------------------------------------- | ---------------------------------------------------------- |
| `20260919000000_init.sql`                     | schema, RLS, triggers                                      |
| `20260919000100_seed_gyms.sql`                | placeholder starter gym list                               |
| `20260920000000_gym_regions.sql`              | `region` column + the real gym list                        |
| `20260920000100_session_windows.sql`          | flexible `start_slot` / `end_slot` windows                 |
| `20260920000200_gyms_admin_only.sql`          | gym list becomes read-only for users                       |
| `20260920000300_second_gym.sql`               | second gym + "Not sure yet"                                |
| `20260920000400_admin.sql`                    | `is_admin` + admin-only gym writes                         |
| `20260923000000_stats_views.sql`              | five stats views (`security_invoker`)                      |
| `20260924000000_public_profile_share.sql`     | `shared_profile()` RPC for `/u/` links                     |
| `20260929000000_grava_gym.sql`                | Grava (Luzon)                                              |
| `20261109000000_hangar8_climb_shack_gyms.sql` | Hangar 8 + Climb Shack (Luzon)                             |
| `20261110000000_comments.sql`                 | session comments + walls, with RLS                        |
| `20270912000000_feedback.sql`                 | `feedback` table + RLS                                     |

Every migration is idempotent, so re-running is safe.

Then, in the dashboard:

- **Auth → Providers → Email** stays enabled. With *Confirm email* on, new users click the
  emailed link before signing in (the app shows a "check your inbox" notice); off, sign-up logs in
  straight away.
- **Auth → URL Configuration** - Site URL = your deployed URL, and add `http://localhost:5173` to
  *Redirect URLs* (the email-confirmation round trip lands there).
- **Settings → API Keys** - copy the **Project URL** and the **publishable key**
  (`sb_publishable_…`). That pair is what a browser app uses. The secret / `service_role` keys
  bypass RLS and must never reach the frontend.

> `VITE_SUPABASE_ANON_KEY` is named for historical reasons; paste the **publishable** key there (a
> legacy `anon` key also works). Everything prefixed with `VITE_` ships to users.

## 2. Run locally

```bash
npm install
cp .env.example .env.local     # then paste your two Supabase values
npm run dev                    # http://localhost:5173
```

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` come from `.env.local` (gitignored); when they are
missing the app renders a setup screen instead of failing with opaque network errors.

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the built output
npm test           # Vitest suite
npm run lint       # oxlint
```

## 3. Deploy to Vercel

1. Push this repo to GitHub, then **Add New → Project → Import** it in Vercel (the Vite
   preset is detected automatically).
2. **Settings → Environment Variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for
   Production *and* Preview, then redeploy.
3. `vercel.json` rewrites every path to `index.html`, so client-side routes such as `/friends` and a
   shared `/u/<username>` link work on refresh. It also 301s `climbcal.vercel.app` to `climbcal.app`
   via a `redirects` entry whose `has` condition matches the host. **`source` must be a path.** A
   `source` holding a full URL fails the *whole deployment* with "Invalid route source pattern" - a
   hostname belongs in `has`. `src/vercel-config.test.ts` asserts this so the config cannot regress.
4. Set Supabase's Site URL to the Vercel domain.
5. Optional: **Analytics → Enable Web Analytics**. Nothing is collected until that toggle is on;
   off Vercel the script simply 404s, so local dev is unaffected.

## Data model

```
auth.users ──1:1── profiles (username, display_name, visibility[public|private])
auth.users ──1:n── climbs   (climb_date, start_time | start_slot, end_time | end_slot,
                             gym_id | custom_gym_name, gym_id_2 | custom_gym_name_2, note)
gyms                        (name, city, region - admin-curated reference data)
auth.users ──n:n── friendships (requester_id, addressee_id, status[pending|accepted])
climbs      ──1:n── climb_comments   (user_id, body ≤ 280)       - the session thread
profiles    ──1:n── profile_comments (user_id, body ≤ 280)       - the wall (guestbook)
```

- One `friendships` row per pair: a unique index over `least()` / `greatest()` of the two ids makes
  an A→B / B→A duplicate impossible.
- Two gym slots, each either a listed gym or a typed name (never both, never blank, the second
  cannot repeat the first); "Not sure yet" simply stores nulls. A two-name session renders as
  **"Either X or Y"**. Because `climbs` references `gyms` twice, every embed names its foreign key
  (`gym:gyms!climbs_gym_id_fkey`, `gym_2:gyms!climbs_gym_id_2_fkey`) or PostgREST cannot tell them
  apart.
- A window is **either** two clock times **or** two labels from `src/lib/slots.ts`;
  `public.window_minutes()` puts both forms on one canonical scale so a single constraint can insist
  the end comes after the start (mixed windows included). The scale is never displayed: labels show
  verbatim and a duration appears only when both ends are clock times.
- Signing up creates the `profiles` row (`on_auth_user_created` trigger); `updated_at` is
  trigger-maintained.
- Comments are two flat tables, no replies: `climb_comments` hangs off a session and
  `profile_comments` is a climber's wall. Both are 1–280 characters, cascade away with their
  session/wall (or the author's account), and freeze everything but `body` on update. Anonymous
  visitors never see them - `shared_profile()` does not read either table.

### Visibility rules (enforced by RLS, not the client)

| Table              | Read                                                                | Write                                                               |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `profiles`         | any signed-in user                                                  | owner only                                                          |
| `gyms`             | any signed-in user                                                  | **admins only** (via `/admin`)                                      |
| `climbs`           | owner, **accepted friends**, or everyone when the owner is `public` | owner only                                                          |
| `climb_comments`   | whoever can read that session (`can_view_climb`)                    | insert as yourself; delete your own or any on **your** session      |
| `profile_comments` | the climber, their friends, or anyone while the profile is `public` | insert as yourself; delete your own or any on **your** wall         |
| `friendships`      | the two participants only                                           | insert self as requester; either side deletes                       |
| `feedback`         | admins only                                                         | any signed-in user inserts; admins manage                           |

Two rules worth knowing: only the **addressee** can flip a request to accepted, and one row exists
per pair (see the data model above).

Nothing is granted to `anon` on the tables, so every surface except `/login` and `/u/<username>`
requires a session. The share page is the single exception and it is deliberately narrow - `anon`
may execute `public.shared_profile(text, date)` and nothing else (see [Share links](#share-links)).

## Admin dashboard

A second, deliberately unlinked surface at **`/admin`**: nothing in the UI points at it, so it is
only reachable by typing the URL.

1. Promote yourself once, in the SQL editor:

   ```sql
   update public.profiles set is_admin = true where username = '<you>';
   ```
2. Open `/admin` and enter the shared password - `ADMIN_PASSWORD` in
   [`src/lib/admin.ts`](src/lib/admin.ts) (`ilikepie`; change it there).

It shows a few counts (climbers, public climbers, gyms, sessions in the next three weeks), the 200
most recent sessions - **every climber's, public or private** - with search and a visibility filter,
the feedback inbox, and the gym list editor (see [Adding a gym](#adding-a-gym)).

The password is a **convenience lock only**: the bundle is public, so anyone can read it out of the
JavaScript, and an unlinked route is obscurity. The real gate is `profiles.is_admin` + RLS - a
signed-in non-admin who unlocks the UI has every write refused. The extra `climbs_select_admin`
policy is what makes the dashboard's counts real rather than "whatever this account is allowed to
see".

## Adding a gym

Gyms are **shared reference data** - one list everybody picks from - not per-user content. A row is
written by an admin or a migration; signed-in climbers only read it. A one-off venue needs no row at
all: type its name in the session's "Other" field and it is stored as `custom_gym_name` on that
climb.

**a. From the admin dashboard (normal way).** Promote yourself (above), unlock `/admin`, scroll to
**Gyms** and press **Add gym**: name (required, blank rejected by `gyms_name_not_blank`), city
(display-only) and region (**Luzon** / **Visayas** / **Mindanao**, or *No region*). The row appears
immediately in the session dropdown, the feed's gym filter and the stats breakdown - no deploy
needed, because it lives in the database.

**b. From the SQL editor.**

```sql
insert into public.gyms (name, city, region)
values ('New Gym', 'Quezon City', 'Luzon')
on conflict ((lower(btrim(name)))) do update
  set region = excluded.region;
```

The conflict target is the `gyms_name_lower_key` unique index, so `'New Gym'` and `'new gym'` cannot
coexist and re-running is safe. Match the seeded spelling exactly to land in the right dropdown
group.

**c. As a migration** (keeps the list in version control - see
[`20260929000000_grava_gym.sql`](supabase/migrations/20260929000000_grava_gym.sql)):

1. Add `supabase/migrations/<timestamp>_<slug>_gym.sql` with the idempotent insert above, then push
   it with `npx supabase@latest db push --include-all --remote` (see the flag notes in step 1).
2. Give it brand colours or it renders the neutral cell: add an entry to `GYM_PALETTES` in
   [`src/lib/gymColors.ts`](src/lib/gymColors.ts), keyed by the gym name, with `primary` and
   `background` hex values.
3. Add the file to `SEED_MIGRATIONS` in [`src/lib/gymColors.test.ts`](src/lib/gymColors.test.ts) and
   bump the `seeded.length` assertion - that test asserts the palette covers **exactly** the seeded
   gyms, so a missing (or extra) palette fails CI.
4. Mention the file in the migration table above and in the project layout below.

**Renaming and deleting.** A rename shows up everywhere, because `climbs.gym_id` is a foreign key.
Delete is permanent: the FK is `on delete set null`, so sessions that used the gym read as **"Not
sure yet"** - rename instead, or back-fill the label first the way
[`20260920000000_gym_regions.sql`](supabase/migrations/20260920000000_gym_regions.sql) did for the
retired placeholders.

**If a gym write is refused.** `new row violates row-level security policy for table "gyms"` means
the request was authenticated but `public.is_admin(auth.uid())` was false - the password only
unlocks the UI. Check `select id, username, is_admin from public.profiles order by created_at;`, set
the flag (by email catches a mistyped username), then reload `/admin`; no sign-out needed. Two
gotchas: `auth.uid()` is null in the SQL editor, so `select public.is_admin(auth.uid())` there
always returns false, and SQL-editor writes bypass RLS - "it works in the SQL editor" proves nothing
about the app.

## Project layout

```
src/
  components/   Layout, ProtectedRoute, SessionFormModal, SessionCard + DaySessions,
                Comments (session thread + wall), ShareLink, ThemeToggle,
                WhatsNewDialog, ui.tsx (primitives + class tokens)
  hooks/        useAuth, useTheme, useWeekClimbs, useClimberStats, useSharedProfile,
                useComments (threads + batched counts), useFriends,
                usePublicClimbers, useGyms, useWhatsNew
  lib/          supabase (client), date (week/month + window + relative-time math),
                format (names, gym grouping), group (feed grouping), stats (heatmap,
                streaks, breakdowns), avatar + gymColors, slots (the eight window
                labels), admin, routes (share + wall paths, safe redirects), whatsNew
  pages/        Login, Onboarding, Week, Stats, Friends, Feed, Wall (a climber's
                guestbook), Settings, SharedProfile (public /u/<username>),
                Admin (unlinked)
  test/         Supabase client mock (tables + `rpc`) + fixtures
supabase/
  migrations/   see the table in step 1
  config.toml   minimal CLI config (link / db push)
```

Queries work in two steps: load the accepted friend ids, then fetch climbs for `self + friends` in
the selected week (embedded gym name included) and map the climber profiles onto the rows. The feed
reuses the same hook with no user filter, letting RLS return the visible rows and keeping only
`visibility = 'public'` profiles - plus your own rows, whatever your visibility.

Comments follow the same shape: one batched count per page, then a thread query (plus an author
profile join) only when a card is opened. Writes are the caller's own rows; the delete policies are
where the session/wall owner moderation lives.

## Theming

Components are written **dark-first** against the Tailwind scales (`zinc` surfaces/text, `emerald`
accent); [`src/index.css`](src/index.css) redefines those same tokens for the light theme, so every
class keeps its *role* in both themes. `ThemeProvider` toggles a `.dark` class on `<html>`.
`src/theme.test.ts` parses the tokens and asserts WCAG AA, and avatar hues stay stable per user id.
Gym cells wear each gym's verbatim brand colours from [`src/lib/gymColors.ts`](src/lib/gymColors.ts)
(deliberately not contrast-corrected). Tokens, primitives and design guidance live in
[DESIGN.md](DESIGN.md).

## Stats views

[`20260923000000_stats_views.sql`](supabase/migrations/20260923000000_stats_views.sql) adds five
read-only views, every one `security_invoker`, so a reader sees exactly the climbs their RLS allows:

| View                     | Grain             | For                                               |
| ------------------------ | ----------------- | ------------------------------------------------- |
| `climb_sessions`         | one climb         | the window normalised onto one scale              |
| `climb_gyms`             | one climb per gym | a two-gym session counts under both               |
| `climber_daily_activity` | climber × day     | the 13-week heatmap                               |
| `climber_totals`         | climber           | the headline cards                                |
| `climber_gym_stats`      | climber × gym     | the "where I climb" breakdown, untagged = `Other` |

A slot-only window ("Opening"…"Closing") gives a *notional* `duration_minutes`, so read it only
when `is_exact_window` is true - `window_minutes` exists to order windows, not to describe them. The
stats page shows none of the minute totals: a climb row is a plan for a *day*. Row types live in
`src/types.ts`, and [`src/lib/statsViews.test.ts`](src/lib/statsViews.test.ts) fails if the view
names, grants or the two labels shared with the app drift apart.

## Share links

A **Share link** (`/u/<username>`) is the one page that works without a session, so it is the only
route outside `RequireAuth` / `RequireProfile`. Its data does not come from the tables - anonymous
visitors have no grants - but from one `security definer` function:

```ts
const { data } = await supabase.rpc('shared_profile', {
  p_username: 'mara',
  p_week_start: '2026-09-14', // the visitor's own Monday, so both sides agree on the week
})
// → { profile, week_start, sessions: [{ id, climb_date, start_time, end_time,
//                                       start_slot, end_slot, gym_name, gym_name_2 }] }
// → null when the username is unknown *or* the profile is private
```

A function rather than an RLS policy, because: only public profiles answer (matched on
`lower(username)`); **notes never leave the database**, since a policy would expose the `note`
column that this hand-built payload simply omits; nothing can be enumerated, as `anon` can ask about
one username at a time; and a private profile is indistinguishable from a typo, so a link cannot be
used to probe for accounts.

`?next=` carries the visitor back - the page links to `/login?next=%2Fu%2Fmara`, and `Login` passes
the same URL as `emailRedirectTo` so the confirmation round trip lands on the profile too.
`loginRedirectPath` / `safeRedirectPath` in [`src/lib/routes.ts`](src/lib/routes.ts) keep that
same-origin, so `?next=` cannot become an open redirect.

## Comments and walls

Two flat threads, no replies, both 1–280 characters:

- **Session comments** - the toggle at the foot of a session card (week grid, today/tomorrow, the
  feed list and the calendar's day list). Readable by whoever may read that session, so a public
  session's thread is exactly as public as the session. In the week grid - seven columns at
  `xl:grid-cols-7`, ~150px each - the toggle is icon + count and the thread opens in a sheet, so
  the narrow column never has to hold a composer.
- **Wall notes** - `/wall/<id>`, reached from a climber's name in the feed, from a Friends row, or
  from the Stats header. Readable by the climber, their friends, and anyone while the profile is
  public.

The author deletes their own comment, and the owner of the session or wall deletes any comment on it
(the delete policies, not the UI, are the real rule - the button is just a mirror). Deletes take two
taps on purpose. Threads load lazily, so a page of collapsed cards costs one batched count query
rather than one request per session. `/u/<username>` is untouched: `shared_profile()` reads neither
comment table, so the share page keeps its "time and gym only, never text" promise.

Apply the migration like any other:

```bash
npx supabase@latest db push --include-all --remote   # or paste the file into the SQL editor
npx supabase@latest migration list --remote          # 20261110000000_comments.sql should be applied
```

## Testing

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm test` and `npm run build` on every push to
`main` and on pull requests - no secrets required.

The suite covers the date/format helpers plus the integration renders against a mocked Supabase
client (`src/test/`): the week view (auth gate, friend lookup, climb query, gym join), the share
page (renders signed out, a private/unknown username reads as "not shared", `rpc('shared_profile')`
and the `?next=` sign-up link are wired), the comment thread (lazy load, posting, both delete rules,
the 280-character cap, the migration notice) and the wall page (a public wall, posting onto it, and a
private stranger's wall staying closed). It also asserts `vercel.json` stays deployable - the SPA
fallback is intact and no `source` is a full URL - and that the theme tokens hold AA contrast in
both themes.

The SQL was validated against a local Postgres with a stubbed `auth` schema: signup trigger, check
constraints, per-visibility reads, one-row-per-pair, "only the addressee accepts", the `anon`
posture (no table access, only `shared_profile` executable), the comment walls (`can_view_climb` /
`can_view_wall` answers, author-or-owner deletes, bodies frozen on update, cascade with the session),
and the stats views against hand-computed fixture rollups.

