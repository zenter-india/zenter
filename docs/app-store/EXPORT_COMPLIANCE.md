# Export Compliance / Encryption

## Code-level check

`app.config.js` already declares:
```js
ITSAppUsesNonExemptEncryption: false,
```
with an existing code comment explaining why: *"the app only uses standard OS-provided HTTPS/TLS (Supabase,
Firebase) — no proprietary encryption — so it's exempt."*

I audited every network call site in the app for anything beyond standard TLS:

- Supabase client (`@supabase/supabase-js`) — HTTPS to `*.supabase.co`
- Razorpay native SDK — its own HTTPS calls, handled entirely inside the SDK
- Expo push service — HTTPS to `exp.host`
- Sentry SDK — HTTPS to Sentry's ingest endpoint

**No custom/proprietary cryptography was found anywhere** — no hand-rolled encryption, no crypto library
beyond what's transitively bundled by these SDKs for standard TLS. The existing `false` declaration is
accurate and does not need to change.

## App Store Connect answer

> **Does your app use encryption?** → **Yes** (any HTTPS use technically counts)
> **Does your app qualify for any of the exemptions provided in Category 5, Part 2?** → **Yes** — the app only
> uses encryption that is exempt (standard TLS/HTTPS for network calls), matching the "Uses only algorithms
> instance in the exemption list" / limited-to-authentication-or-industry-standard path.
> Result: **`ITSAppUsesNonExemptEncryption = false`** — matches what's already configured.

No French export-compliance documentation is required for this exemption category. No code change needed.
