# App Privacy — code-level audit → App Store Connect questionnaire answers

Source: direct code/schema inspection of `app/react-native` (this repo) + the live production Supabase
project (`wppuzqaigtffcpuvjolt`) + the live Privacy Policy at https://zenter.in/privacy. No answer below is
guessed; every "Not collected" is backed by an absence of the relevant SDK/permission/field in the codebase.

## Data types collected, mapped to Apple's categories

| Apple category | Collected? | Linked to identity? | Used for tracking (Apple's ATT definition)? | Purpose | Where stored/sent |
|---|---|---|---|---|---|
| **Contact Info — Name** | Yes (`full_name`) | Yes | No | App functionality (profile) | Supabase `users` table |
| **Contact Info — Phone Number** | Yes (E.164, via OTP) | Yes | No | Account creation, auth | Supabase Auth (`auth.users.phone`) + `users.phone` |
| **Contact Info — Email** | No | — | — | The app has no email field anywhere; only phone-based auth. `feedbacks`/support flows use email only as an outbound `mailto:` link, never collected in-app. | — |
| **User Content — Other User Content (chat messages)** | Yes | Yes | No | Core app functionality (co-ordination chat) | Supabase `messages` table, gated by RLS to the two conversation participants |
| **Identifiers — User ID** | Yes (internal UUID) | Yes | No | Account functionality | Supabase `users.id` |
| **Identifiers — Device ID** | Yes (Expo push token, a device-scoped identifier, not IDFA) | Yes (linked to `user_id`) | No | Push notification delivery only | Supabase `device_tokens` table, RLS-scoped to the owning user (this session) |
| **Usage Data — Product Interaction** | Yes (custom first-party event log — see Analytics below) | Yes (`user_id`, nullable) | No | Internal product analytics only, never shared with a third-party ad/analytics network | Supabase `analytics_events` table |
| **Diagnostics — Crash Data** | Yes (Sentry, `@sentry/react-native`) | Not intentionally (no explicit user-id tagging found in `src/lib/observability.ts`'s `Sentry.init()`) | No | Crash reporting | Sentry (third party — see below) |
| **Financial Info — Payment Info** | Not collected by Zenter's own servers | — | — | Razorpay's native checkout SDK collects card/UPI details directly; Zenter's backend only ever receives an order id, payment id, and signature to verify (`src/api/payment.ts`) — never raw card/bank data | Razorpay (third party) |
| **Location** | **Not collected as device GPS.** The app has no `expo-location` dependency and no geolocation API call anywhere in the codebase. Users self-report their exam-centre **state/district** (text picklists in onboarding/profile), which is user-entered profile data, not device location. | Yes (self-reported field, same as name) | No | Matching aspirants at the same exam centre | Supabase `users` table (`exam_centre_state`, `exam_centre_district`) |
| **Contacts (device address book)** | Not collected — no `expo-contacts`, no permission requested | — | — | — | — |
| **Photos** | Not collected — `NSPhotoLibraryUsageDescription` exists only to satisfy an Apple static-scan false-positive from an unused Sentry symbol (see `IOS_PERMISSIONS.md`); no image picker, no avatar upload exists in the app (avatars are text-initials only, `src/components/Avatar.tsx`) | — | — | — | — |
| **Audio/Microphone** | Not collected — no `expo-av`/microphone permission/API anywhere | — | — | — | — |
| **Health & Fitness** | Not collected | — | — | — | — |
| **Search History** | Not collected as a distinct product feature | — | — | — | — |
| **Browsing History** | Not collected | — | — | — | — |
| **Sensitive Info** | Not collected | — | — | — | — |

## ⚠️ Discrepancy flagged for owner review

The **production Privacy Policy** (https://zenter.in/privacy, §2B) states the platform collects "**Location
Information (mandatory) for centre filtering purpose**," worded as if device location is collected. The
**actual code** only collects self-reported exam-centre state/district text fields — no GPS/device location
API is present anywhere in the repo (`app.config.js` requests no location permission; no `expo-location`
dependency). **OWNER ACTION REQUIRED**: confirm this is intentional wording (i.e. "location information" means
the self-reported centre location, not GPS) — if so, no code or policy change is needed, but the App Store
Connect privacy questionnaire below answers based on the **actual code behavior** (self-reported profile field,
not device location), since that's what Apple's reviewers will actually observe testing the app. If the policy
text is meant to describe real GPS collection that hasn't been implemented yet, that's a policy/reality
mismatch that should be fixed before submission regardless of Apple review.

## Third-party SDK / service audit

| SDK / Service | Package | What it receives | Purpose |
|---|---|---|---|
| **Supabase** | `@supabase/supabase-js` | All app data (profile, connections, messages, device tokens) — this is the primary backend, not a third-party analytics/ad network | Backend-as-a-service (Postgres + Auth + Realtime + Edge Functions) |
| **Twilio (Verify)** | none client-side — invoked server-side by Supabase Auth's phone provider | Phone number, for SMS OTP delivery only | OTP delivery |
| **Razorpay** | `react-native-razorpay` | Name/phone (prefill), payment details (handled entirely by Razorpay's own native SDK sheet, not passed through Zenter's servers) | Payment processing for Zenter Plus |
| **Sentry** | `@sentry/react-native` | Crash stack traces, device/OS info; DSN read from `EXPO_PUBLIC_SENTRY_DSN` at runtime | Crash reporting |
| **Expo push service** | `expo-notifications` (this session) | Push token, notification payload text (title/body — sender name, message preview) | Push notification delivery |
| **Firebase (`@react-native-firebase/app`, `@react-native-firebase/auth`)** | Still compiled into the binary (see below) | Unknown — see flag below | Formerly phone auth; **no longer used for that as of this dev cycle** |

### ⚠️ Firebase SDK is still present in the compiled binary — OWNER ACTION REQUIRED

This app migrated phone authentication from Firebase Auth to Supabase Auth (Twilio Verify) earlier in this
development cycle. **However**, `@react-native-firebase/app` and `@react-native-firebase/auth` are still
listed in `package.json` and as plugins in `app.config.js`, and `plugins/withExplicitApnsRegistration.js`
still calls `FirebaseApp.configure()` in the native AppDelegate on every launch. No application code path
calls Firebase Auth anymore (verified — only stale code comments mention "Firebase" now), but **the SDK is
still initialized at app launch**, and Firebase's own SDKs are known to phone-home basic install/device
telemetry to Google on initialization even when the specific product (Auth) isn't actively used for anything.

This has two implications for this submission:
1. **Privacy questionnaire accuracy**: if Firebase is genuinely inert, the "Data Not Linked to You" / minimal
   collection framing below still needs Firebase acknowledged as a linked SDK if it does phone home on init —
   I cannot verify this without Firebase's own private telemetry docs/network capture, which is out of scope
   for a code audit.
2. **Clean-up opportunity**: since Firebase is no longer functionally used, removing
   `@react-native-firebase/*`, the `withExplicitApnsRegistration` plugin, and the `GoogleService-Info.plist`
   reference before this submission would both shrink the privacy surface and remove an entire unused native
   dependency. This was previously deliberately deferred (2–4 weeks, for rollback safety on the auth
   migration) — that safety window has likely passed by now given how much has shipped on Supabase Auth since.

**This audit does not remove Firebase** (that's a build-affecting code change outside this audit's scope per
your operating rules) — flagging it here as an **OWNER DECISION** before finalizing the privacy answers below.

## App Store Connect "App Privacy" questionnaire — answer sheet

Answer **"Yes, we collect data from this app"**, then:

- **Contact Info → Name**: Collected, linked to user, **not** used for tracking. Purpose: App Functionality.
- **Contact Info → Phone Number**: Collected, linked to user, **not** used for tracking. Purpose: App
  Functionality (Account creation/auth).
- **User Content → Other User Content**: Collected (chat messages), linked to user, **not** used for tracking.
  Purpose: App Functionality.
- **Identifiers → User ID**: Collected, linked to user, **not** used for tracking. Purpose: App Functionality.
- **Identifiers → Device ID**: Collected (push token), linked to user, **not** used for tracking. Purpose: App
  Functionality (push notifications).
- **Usage Data → Product Interaction**: Collected, linked to user (nullable), **not** used for tracking.
  Purpose: Analytics (first-party only).
- **Diagnostics → Crash Data**: Collected, **OWNER TO CONFIRM** whether linked to user (audit found no explicit
  user tagging in Sentry init, but confirm nothing elsewhere sets `Sentry.setUser()`). Not used for tracking.
  Purpose: App Functionality.
- **Financial Info → Payment Info**: **Not collected by Zenter.** (Razorpay collects it directly; Zenter never
  receives raw payment credentials — only pre/post-transaction identifiers.) Leave unchecked, unless Apple's
  current UI requires acknowledging Razorpay's collection on your behalf — **OWNER ACTION REQUIRED**: this is
  a judgment call between "we don't collect it" (technically true) vs. "a linked third party processes it on
  our platform" (also arguably true); Apple's own guidance leans toward declaring it if any payment flow exists
  in the app, even via a third-party SDK.
- **Location**: based on the code (self-reported text field, not GPS) — **not** "Precise Location" or "Coarse
  Location" in Apple's technical sense. If declared at all, it would fall under a general profile-data
  category, not Apple's dedicated Location category. **OWNER ACTION REQUIRED** given the policy-wording
  discrepancy flagged above — resolve that first, then answer this question to match.
- **All other categories** (Photos, Camera, Microphone, Contacts, Health, Browsing History, Search History,
  Sensitive Info, Financial Info beyond payment, Purchase History as a distinct linked record): **Not
  Collected.**

**Tracking**: answer **"No, we do not track users"** — see `TRACKING_AUDIT.md` for the full reasoning; no
ad/attribution SDK exists in the dependency tree.
