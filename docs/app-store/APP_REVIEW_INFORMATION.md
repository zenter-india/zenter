# App Review Information

## Contact Information

Derived from the live production Privacy Policy (https://zenter.in/privacy) and the Apple Developer account
already used to build/sign this app (Team ID H5G7S347ZN, "PON BUVANESHWARAN MATHIALAGAN", Individual):

- **First name**: Pon (per Apple Developer account: "PON BUVANESHWARAN"; privacy policy lists proprietor as
  "PON BUVANESHWARAN" — the same person)
- **Last name**: Buvaneshwaran — **OWNER ACTION REQUIRED: confirm exact first/last name split** (the source
  documents give the full name as one string; App Store Connect wants it split, and I should not guess where
  to cut a South Indian name that may not follow a Western first/last convention)
- **Phone**: `+91 6363613007` (the in-app support number, `app/contact.tsx`) — **OWNER ACTION REQUIRED:
  confirm this is the right number for Apple to reach specifically about this app, vs. the account holder's
  personal number**
- **Email**: `support@zenter.in` (in-app + privacy policy, verified live)

## Sign-In Information

**Login is mandatory.** There is no guest/browse-without-account mode — `app/index.tsx` routes every
logged-out user straight to `/(auth)/welcome` → phone entry → OTP.

**Authentication method**: phone number + OTP, via Supabase Auth's phone provider backed by Twilio Verify
(migrated from Firebase Phone Auth this development cycle). The OTP is a real SMS sent to a real phone number
— there is no username/password option.

### RESOLVED: reviewer-safe login path is configured

Confirmed live in Supabase Auth's phone Test OTP config: `916363613007=123123`. The reviewer types
`6363613007` into Zenter's normal phone field (same as any real Indian number) and `123123` as the OTP — this
bypasses real SMS delivery for that number only; every other number still goes through real Twilio SMS
exactly as before.

The rest of this section is kept for context on how it works and why it was needed:

Originally, I searched the Supabase Auth configuration, migrations, and app code for any of the following and
found **none**:

- a fixed reviewer/test account
- a hard-coded or config-driven test OTP
- a bypass/reviewer mode
- a preconfigured demo account

Apple reviewers test from Cupertino/contracted review facilities and are not guaranteed to hold an Indian
phone number capable of reliably receiving Twilio-delivered Indian SMS. A phone-OTP-only app with no reviewer
path is a common and avoidable rejection reason ("we were unable to sign in").

**Recommended fix (safe, production-compatible, no code change, no global auth weakening):**
Supabase Auth has a built-in mechanism for exactly this: **Authentication → Sign In / Providers → Phone → "Test
OTP numbers"** in the Supabase dashboard. You register one or more specific phone numbers (e.g. a real Indian
number you control, or a dedicated Apple-review-only number) each paired with a fixed 6-digit code of your
choosing. Supabase's `signInWithOtp`/`verifyOtp` then short-circuits Twilio for *only* that number/code pair —
every other number still goes through real Twilio SMS delivery exactly as today. This is:

- **Not a code change** — it's a dashboard setting, so Build 10 does not need to be rebuilt for this.
- **Scoped**, not a global weakening — only the specific number(s) you register bypass real SMS; nothing else
  about the auth flow changes.
- **Apple's documented preferred pattern**: App Review explicitly asks for a demo account credential when
  login is required (App Store Connect's own "Sign-In Required" toggle asks for a username/password field —
  for phone-OTP apps, the equivalent is giving them a phone number + the fixed code).

**OWNER ACTION REQUIRED**: configure a Test OTP number in the Supabase dashboard for the production project
(`wppuzqaigtffcpuvjolt`), then supply that phone number + fixed code below for the App Store Connect "Sign-In
Required" fields. Until this exists, treat reviewer login as unverified and do not submit.

## Review Notes (ready to paste into App Store Connect)

```
Zenter helps students preparing for competitive exams (NEET UG/PG, INICET, NEET MDS/SS) find and coordinate
with other aspirants assigned to the same exam centre, to share travel and accommodation.

HOW TO SIGN IN
Zenter uses phone number + SMS OTP for sign-in (no email/password). Use the test number and code provided in
the "Sign-In Required" fields above — entering that number and code signs in without sending a real SMS.

AFTER SIGNING IN
On first sign-in you'll be asked to complete a short profile: exam type, exam centre state/district, and
travel/stay preferences. This is required before the main app is reachable.

MAIN FUNCTIONALITY
- "Find" tab: browse other aspirants at your exam centre / district, filter by travel/stay plans.
- Tapping a card opens a read-only profile preview with a "Connect" button to send a co-ordination request.
- "Requests" tab: incoming/outgoing connection requests, accept or decline.
- "Co-ordinations" tab: your accepted connections.
- "Chats" tab: in-app messaging with accepted connections only — messaging is gated behind mutual acceptance,
  there is no open/public chat.
- Header hamburger menu (top-right on Find/Requests/Co-ordinations/Chats): Zenter Plus, My profile, legal
  pages, FAQ, Contact support, Feedback, Log out.

PERMISSIONS
The app does not request Camera, Photo Library, Microphone, Location, or Contacts access. It does request
push notification permission (for connection-request and chat-message alerts) — this can be declined without
affecting core functionality.

PAYMENTS / IN-APP PURCHASES
"Zenter Plus" (My profile → Get Zenter Plus) is an optional paid upgrade unlocking a featured profile card and
unlimited connections/chats.
[OWNER: fill in here once the iOS payment-provider issue in PAYMENTS_REVIEW.md is resolved — do not submit
with this section blank, since the reviewer will attempt to trigger this flow.]

FEATURES THAT DEPEND ON ANOTHER USER
Sending a connection request, accepting it, and chatting all require a second account. Seeded/demo aspirant
profiles are visible in Find so a reviewer can send a request and preview a profile without needing a second
real device/account — the request will show as "pending" since the seeded profile cannot accept it back.

ACCOUNT DELETION
My profile → scroll to "Privacy & account" → "Delete account" → confirm. This immediately and permanently
deletes the profile and connections (see ACCOUNT_DELETION.md for the exact backend behavior).

CONTACT
support@zenter.in / +91 6363613007
```

**OWNER ACTION REQUIRED**: fill in the bracketed payments paragraph above once the Payments Audit's release
blocker (see `PAYMENTS_REVIEW.md`) is resolved one way or another — Apple reviewers routinely attempt every
visible purchase button, so an unresolved iOS payment path will very likely surface during review regardless
of what these notes say.
