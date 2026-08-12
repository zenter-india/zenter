# Zenter — Claude Context

Zenter (zenter.in) is a roommate-matching web app for Indian medical exam aspirants (NEET UG, NEET PG, FMGE, UPSC CMS, etc.). Users create profiles, find mates appearing at the same exam centre, send connection requests, and reveal contact details to connect. It is a **live production app** with real users.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES modules), HTML, CSS — no framework |
| Auth | Firebase Phone OTP (`js/firebase-config.js`) |
| Database | Supabase (Postgres + RLS) — project ID: `wppuzqaigtffcpuvjolt` |
| Hosting | Vercel (root `/` files) |
| Mobile | Capacitor Android (`www/` folder is the bundle) |
| Edge Functions | Supabase (Deno) |

---

## CRITICAL: Dual File Structure — Always Sync `www/`

Every JS and HTML file exists in **two places**:

- `js/*.js` and `*.html` → served by **Vercel** (web)
- `www/js/*.js` and `www/*.html` → bundled by **Capacitor** (Android app)

**After editing any file in `js/` or root `*.html`, you MUST copy it to `www/`:**

```bash
cp js/dashboard.js www/js/dashboard.js
cp js/supabase.js www/js/supabase.js
# etc.
```

Forgetting this means web and app are out of sync. This has broken users on mobile before.

---

## Branching Rules

| Branch | Purpose |
|---|---|
| `main` | Production — zenter.in. Push here after staging confirms working. |
| `stage-zenter` | Staging. All new work goes here first. |
| `feature/monetization` | Payment integration only. **NEVER merge into stage or main without explicit approval.** |

**Workflow for every change:**
1. Edit files
2. Sync `www/` copies
3. `git push origin main:stage-zenter` — test on staging
4. `git push origin main` — only after confirming stage works

---

## Branch Safety Rules (Non-Negotiable)

- **NEVER** copy code from `feature/monetization` into `stage-zenter` or `main` without adding ALL missing dependencies first.
- **ALWAYS** verify every named import exists as an export in `supabase.js` before pushing.
- Module-level variables used across functions = `let` at top of file, NOT `const` inside a function.
- After editing `dashboard.js` or `supabase.js`: mentally trace the import chain before pushing.

> **Why:** A missing named import crashes the entire ES module silently. Users see a blank page. This happened in production on 2026-06-05 and took 15 min to diagnose.

---

## Key Files

| File | Role |
|---|---|
| `js/supabase.js` | All DB queries and RPC calls. Add new DB functions here. |
| `js/dashboard.js` | Main feed, filtering, connections, chat tabs. Core user flow. |
| `js/connections.js` | Connections tab — received requests, accepted connections. |
| `js/utils.js` | Shared helpers. `checkSuspended(me)` lives here. |
| `js/auth.js` | Firebase auth guards (`requireOnboarded`, `logout`). |
| `js/admin.js` | Admin panel — users, reports, seeded users, analytics. |
| `js/ui.js` | Shared UI helpers: `toast()`, `setButtonBusy()`, bottom nav. |
| `js/location-data.js` | All Indian states, districts, UPSC CMS centres. |
| `js/relationships.js` | Connection relationship state machine (REL constants). |
| `admin.html` | Admin panel (superadmin only). |
| `dashboard.html` | Main app page (Find Mates + tabs). |
| `onboarding.html` | Profile creation flow. |

---

## Live Exam Types

Defined in `LIVE_EXAMS` array in `dashboard.js` and `connections.js`:

```js
['NEET UG', 'NEET PG', 'UPSC CMS', 'INICET', 'NEET MDS', 'NEET SS', 'FMGE']
```

- **UPSC CMS** — special handling: skips state-level matching, uses 48 CMS exam centres instead of districts. See `UPSC_CMS_CENTRES` in `location-data.js`.
- **FMGE** — added 2026-06-17. Uses standard state/district/centre flow like NEET.
- Any exam type NOT in `LIVE_EXAMS` → redirect to `/maintenance.html`.

---

## Database — Key Tables & Columns

### `users`
Core user table. Key columns:
- `phone` — E.164 format, primary identifier
- `exam_type` — one of the live exam types
- `account_status` — `null`/`'active'` = normal, `'suspended'` = locked out
- `appeal_submitted_at` — timestamptz, set when user submits suspension appeal
- `suspension_warning` — boolean, set when admin dismisses appeal (restores access with one-time warning)
- `role` — `'user'` | `'admin'` | `'superadmin'`
- `plus_member` — Zenter Plus membership
- `is_verified_aspirant` — roll number verified
- `suspicious_flags` — JSONB: `{ rapid_reveal: true }` etc.
- `device_fingerprint` — for multi-account detection
- `is_seeded_user` — true for demo/fake accounts

### `seeded_users`
Separate table for fake/demo profiles shown in the feed. Same shape as `users` minus auth fields.

### `connections`
- `sender_id`, `receiver_id`, `status` (`'pending'` | `'accepted'`)

### `conversations` / `messages`
Chat system between accepted connections.

### `platform_config`
Key-value config (free reveal limit, Plus enabled toggle, etc.).

---

## Supabase RPCs (custom functions)

All RPC calls go through `supabase.rpc('rpc_name', { params })` wrapped in the `query()` helper.

Key RPCs:
| RPC | Purpose |
|---|---|
| `admin_set_user_status` | Suspend / unsuspend a user |
| `admin_dismiss_appeal` | Unsuspend + set suspension_warning (user sees one-time warning) |
| `dismiss_suspension_warning` | User acknowledges warning (clears flag) |
| `flag_rapid_reveal` | Sets rapid_reveal suspicious flag |
| `increment_reveal_count` | Tracks contact reveals |
| `admin_set_user_role` | Promote/demote admin |
| `admin_clear_suspicious_flags` | Clear flags from Users panel |
| `create_conversation_for_connection` | Start chat after connection accepted |

---

## Suspension System (added 2026-06-17)

### User states and what they see

1. **Suspended** → blur overlay: "Dear Aspirant, Our system has detected an suspicious activity that your actions violate the Community Guidelines." + **Contact Support** button (mailto:support@zenter.in) + Sign out link.

2. **Unsuspended with warning by admin** → user is unsuspended (`account_status = 'active'`), `suspension_warning = true`. On next page load: warning overlay "Dear Aspirant, Your matching function has been restored. Please regulate according to the guidelines and wish you a happy Zentering!" + **I Understand** button (clears flag, never shown again).

### Where it's enforced

`checkSuspended(me)` in `js/utils.js` — called on every page after fetching the user profile. Returns `true` (blocking) if suspended. Also shows warning overlay (non-blocking) if `suspension_warning = true`.

Pages that call it: `dashboard.js`, `connections.js`, `profile.js`, `blocked-users.js`.

### Admin actions (Users tab in admin.html)

- **Suspend** button → sets `account_status = 'suspended'`
- **Unsuspend** button → sets `account_status = 'active'`, clears appeal
- **⚠️ Appeal** badge → shown when `appeal_submitted_at` is set
- **Dismiss Appeal** button → calls `admin_dismiss_appeal` RPC (unsuspend + warn)
- Filter: "⚠️ Pending Appeal" → shows only users with pending appeals

---

## Suspicious Flags System

Two flags tracked in `suspicious_flags` JSONB column:

| Flag | Detection | Label in admin |
|---|---|---|
| `rapid_reveal` | DB RPC `flag_rapid_reveal` — 2 contact reveals in < 60s | ⚡ Rapid reveal |
| Multi-account | Client-side: same `device_fingerprint` across multiple users | 📱 Multi-account |

Admin can clear flags via **Clear** button in the Flags column.

---

## Adding a New Exam Type (checklist)

1. `index.html` + `www/index.html` — add pill in landing hero
2. `onboarding.html` + `www/onboarding.html` — add `<option>` in exam select
3. `js/dashboard.js` + `www/js/dashboard.js` — add to `LIVE_EXAMS` array and `examYearDisplay` map
4. `js/connections.js` + `www/js/connections.js` — add to `LIVE_EXAMS` array
5. `js/admin.js` + `www/js/admin.js` — add to `ALL_EXAM_TYPES` array
6. `admin.html` — add `<option>` to `adm-user-filter-exam` select
7. Supabase: seed users if needed (`supabase/migrations/`)

---

## Adding a New Supabase RPC (checklist)

1. Write migration SQL in `supabase/migrations/YYYYMMDD_name.sql`
2. Apply via Supabase MCP (`apply_migration`) or dashboard
3. Add JS wrapper in `js/supabase.js`: `export function myFn(params) { return query(supabase.rpc('rpc_name', { p_param: params })); }`
4. Copy `js/supabase.js` → `www/js/supabase.js`

---

## Payments (DO NOT TOUCH without explicit instruction)

- Razorpay integration lives **only** on `feature/monetization` branch
- Never add payment buttons, Razorpay SDK, or payment logic to `stage-zenter` or `main`
- Required env vars when ready: `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PLUS_PRICE_PAISE`

---

## Production Incident — 2026-06-05

**What happened:** All users on zenter.in saw a blank Find Mates page. Admin panel link invisible.

**Root cause:**
1. Named imports in `dashboard.js` referenced functions (`attemptReveal`, `trackEvent`) that didn't exist in `stage-zenter`'s `supabase.js` — they were only on `feature/monetization`. ES module import failure = silent crash, blank page.
2. `myExamTypeForFeed` declared as `const` inside `init()` but used in `loadData()` (different function, out of scope).

**Lesson:** Always verify imports exist in the same branch before pushing. Variables used across functions must be module-level `let`.

---

## Zenter Plus

- `plus_member` boolean on `users` table
- Free users: limited contact reveals (`my_free_limit` from `platform_config`)
- Plus members: unlimited reveals, no gating
- Admin can grant/revoke Plus from Users panel
- Plus purchase page: `/plus.html`
- **Payment integration pending** on `feature/monetization` branch

---

## Code Conventions

- No framework — plain HTML, CSS, ES modules
- All DB access goes through `js/supabase.js` (never raw fetch to Supabase URL)
- `query(...)` wrapper handles errors uniformly — always returns `{ data, error }`
- `esc(str)` used everywhere for XSS-safe HTML rendering
- `toast(msg, variant)` for user feedback (`'success'` | `'error'`)
- CSS variables: `--hm-primary`, `--hm-text`, `--hm-surface`, `--hm-text-muted`, etc.
- Admin CSS classes: `adm-btn`, `adm-btn--ok` (green), `adm-btn--warn` (amber), `adm-btn--danger` (red), `adm-pill`
