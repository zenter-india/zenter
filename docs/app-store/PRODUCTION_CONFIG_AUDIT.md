# Production Environment Audit — Build 10 intent

No secret **values** are reproduced below — only variable names and configuration state, per your instruction.

| Item | Production state | Evidence |
|---|---|---|
| API/backend URL | `EXPO_PUBLIC_SUPABASE_URL` baked into the `production` EAS build profile, pointing at the one and only Supabase project used throughout this entire development cycle (`wppuzqaigtffcpuvjolt`) — no separate staging project exists in this repo's configuration | `eas.json` → `build.production.env` |
| Supabase environment | Single project, no branch/staging split configured in `eas.json` or `app.config.js` | `eas.json` |
| Firebase configuration | `google-services.json`/`GoogleService-Info.plist` still referenced (see `APP_PRIVACY.md`'s Firebase-still-compiled flag) — files are gitignored, sourced via env override or local `./config/` path | `app.config.js` |
| Twilio environment | Not client-configured at all — entirely server-side inside Supabase Auth's phone provider, invisible to the app build | N/A |
| Push notification config | `expo-notifications` plugin registered this dev cycle; EAS push credentials (Android FCM V1 service account, iOS APNs key) were set up this session directly in EAS's credential store, not in repo files | `app.config.js` plugins, this session's work |
| Payment environment | `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are Edge Function secrets (server-side, not in this repo) — not inspectable from the client codebase, and out of scope for a client-side audit | `supabase/functions` referenced from `src/api/payment.ts`, secrets not visible to this audit |
| Logging | `console.warn`/`console.error` gated behind `if (__DEV__)` in every location checked (`src/api/*.ts`, `src/lib/pushNotifications.ts`, this session's push trigger code) — no verbose logging expected in the production bundle | Multiple files, spot-checked |
| Debug flags | None found — no dev-only menu, no feature-flag override UI reachable from the shipped app | Full `app/` tree scan |
| Feature flags | `platform_config.feature_toggles` (live, server-controlled): `signup: true, feedback: true, find_mates: true, connections: true, announcements: true` — all core features are enabled in production right now | Live Supabase query, this session |
| Mock OTP / bypass auth | **None found in client code** — confirmed no `__DEV__`/mock/bypass branch exists anywhere in `phoneAuth.ts` or the `(auth)` screens; every build path (dev, preview, production) uses the same real Twilio-backed OTP flow. This is exactly why `APP_REVIEW_INFORMATION.md` flags reviewer login as a release blocker — there is no dev-only shortcut to accidentally leave enabled, but also none to safely hand reviewers today. | `src/features/auth/phoneAuth.ts`, `app/(auth)/*.tsx` |
| Development menus | Only the standard Expo dev-client menu, which is only compiled into the `development` EAS profile (`developmentClient: true`), not `production` | `eas.json` |
| Test credentials | None hard-coded anywhere in the repo | Full scan |
| Hard-coded secrets | None found — every credential referenced is via `process.env.*` or Supabase/EAS secret stores | `app.config.js`, `eas.json`, `src/api/*.ts` |
| Sentry | Present, DSN via `EXPO_PUBLIC_SENTRY_DSN` env var; `SENTRY_DISABLE_AUTO_UPLOAD=true` is set in every build profile in `eas.json` because the three `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` values aren't configured as EAS secrets yet — **this means production crash reports upload to Sentry at runtime, but build-time source-map upload is disabled**, so a production crash won't be de-minified/symbolicated in the Sentry dashboard until those three secrets are added. Not an App Review blocker (invisible to Apple), but worth fixing for your own crash-triage ability post-launch. | `eas.json`, in-repo comment on the flag's own history |

## Verdict

**PASS for App Review purposes** — nothing here is reviewer-visible or a rejection risk. The one real
operational note (Sentry source maps disabled) is a "you'll want to fix this for yourself" item, not a
submission blocker.
