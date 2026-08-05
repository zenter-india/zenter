# App Transport Security / Networking Audit

## Search performed

Searched the entire `app/` and `src/` tree for: `http://` (non-HTTPS), `localhost`, `127.0.0.1`, raw IP
literals, and any `NSAppTransportSecurity`/ATS-exception configuration in `app.config.js`.

**Result: clean.**
- No `http://` URL found anywhere in application source (only `https://` endpoints: Supabase project URL,
  `api.razorpay.com`, `exp.host`, Sentry's ingest host).
- No `localhost`/`127.0.0.1`/hard-coded IP found in application source.
- `app.config.js` declares **no ATS exceptions** (`NSAppTransportSecurity` key is entirely absent) — meaning
  the app runs under Apple's default, strictest ATS policy (HTTPS-only, no exceptions). This is the most
  conservative and reviewer-friendly configuration possible.
- No debug/mock API toggle, no "dev menu" endpoint switcher shipped in the runtime code (env values are
  baked in per EAS build profile at build time via `eas.json`'s `env` blocks, not switchable at runtime).

## Endpoints the production build actually talks to

| Endpoint | Purpose | Protocol |
|---|---|---|
| `https://wppuzqaigtffcpuvjolt.supabase.co` | Primary backend (DB, Auth, Realtime, Edge Functions) | HTTPS |
| `https://api.razorpay.com` | Payment processing (via `react-native-razorpay`'s own SDK) | HTTPS |
| `https://exp.host` | Expo push notification delivery | HTTPS |
| Sentry ingest host (DSN-derived, not hard-coded) | Crash reporting | HTTPS |
| Twilio (server-side only, via Supabase Auth's phone provider) | SMS OTP delivery | HTTPS, never called directly from the app |

## Verdict

**PASS — no release blocker.** Production networking is HTTPS-only, no dev/staging endpoint leakage, no ATS
exceptions to justify to reviewers.
