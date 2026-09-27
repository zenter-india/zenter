# Zenter — Native Mobile App Build Prompt (for Lovable)

Copy everything below into Lovable as the project prompt.

---

## Project

Build **Zenter**, a roommate/exam-mate coordination app for Indian medical exam
aspirants (NEET UG, NEET PG, FMGE, INICET, NEET MDS, NEET SS, UPSC CMS). Users
create a profile, get matched with other aspirants going to the same exam
centre, send connection requests, and unlock chat to coordinate travel and
stay once a request is mutually accepted.

**This build target is a mobile app, exported to iOS and Android via
Capacitor — not a website.** The visual design (colors, typography, spacing,
copy, layout) must match the existing Zenter web app exactly. Nothing about
the UI should change. What changes is the *architecture*.

## Non-negotiable architecture requirement

Do **not** build this as a set of separate HTML pages that get loaded by URL
(e.g. `/dashboard.html`, `/profile.html`) inside a WebView shell — that is a
webview-wrapper pattern and is explicitly rejected for this project.

Instead, build a **single-page React app-shell**:
- One app instance, mounted once.
- All screens are React components rendered by client-side state/router
  (e.g. React Router in "memory"/native mode, or a simple screen-stack state
  machine) — never a full page navigation or URL reload between screens.
- Bottom tab bar and stack-based screen transitions should feel like native
  navigation (slide transitions, no flash of white, no browser chrome ever
  visible, no address bar, no reload).
- Package for iOS/Android via **Capacitor**. Handle the Android hardware
  back button to pop the screen stack (not exit the app) except at root
  screens.
- Static legal pages (Terms, Privacy, Community Guidelines, Refund Policy,
  FAQ) may be simple in-app screens rendering the same copy — not external
  links.

## Design system — reuse these tokens exactly

**Fonts:** Inter (body, weights 400/500/600/700), Poppins (headings/display,
weights 500/600/700).

**Colors:**
```
--primary: #FF6B35        /* brand orange — CTAs, active states */
--primary-600: #EF5A23    /* hover/pressed */
--primary-100: #FFE9DD    /* light tint backgrounds */
--surface: #FFFFFF
--surface-2: #F1F5F9      /* subtle section backgrounds */
--border: #E2E8F0
--border-strong: #CBD5E1
--text: #0F172A
--text-muted: #475569
--text-subtle: #94A3B8
--danger: #EF4444
--warning: #F59E0B
```

**Spacing scale (px):** 4, 8, 12, 16, 24, 32, 48, 64, 96
**Corner radius:** sm 8, md 12, lg 16, xl 24, pill 999
**Type scale (px):** xs 12, sm 14, base 16, lg 18, xl 22, 2xl 28, 3xl 36, 4xl 48

Buttons: pill/rounded-lg, solid orange primary with white text; ghost variant
with border and muted text. Cards: white surface, `border-radius: lg`, subtle
border, soft shadow on elevation. Badges: small pill shape (e.g. "⭐ Plus",
"✓ Verified") with tinted background matching their semantic color.

## Screen inventory & navigation structure

### Auth stack (shown when logged out)
1. **Landing/Welcome** — brand intro, exam-type pills (NEET UG/PG, FMGE,
   INICET, NEET MDS, NEET SS, UPSC CMS), value proposition, "Get started"
   CTA → phone entry.
2. **Phone entry** — country code +91 fixed, 10-digit input, "Send OTP".
3. **OTP verify** — 6 individual digit cells, auto-advance/auto-submit,
   resend countdown (30s), back to phone entry.
4. **Onboarding** (multi-step, only for new users after first verified
   login): name, gender, exam type, exam centre state/district (special
   case: **UPSC CMS** skips state/district and instead picks from a fixed
   list of ~48 CMS exam centres), home city, college, travel mode (Train/
   Flight/Bus/Self Drive/Shared Cab/Yet to Decide), stay plan (Needs stay/
   Has stay/Room share/Yet to Decide), short bio. Progress indicator across
   steps. Final step submits and routes into the main app.

### Main app (bottom tab bar, shown when logged in + onboarded)

**Tab 1 — Find Aspirants** (default/home tab)
- District list screen: search box, list of districts with aspirant counts,
  tapping a district pushes the aspirant list for that district.
- Aspirant list screen: filter bar (gender, exam centre, travel mode, stay
  plan — presented as a bottom sheet or side panel, not a full page), scrolling
  card list. Each card: avatar/initials, name, gender, Plus/Verified badges,
  masked location, exam centre name, travel/stay icons, "Request" button.
- Aspirant detail (tap a card, or modal/sheet): full profile view, masked
  phone number (never real number pre-connection), request button.
- A persistent reveal/chat-limit banner when the free-tier chat allowance is
  low, linking to the Plus paywall screen.

**Tab 2 — Requests**
- Incoming connection requests list: name, exam centre, "Accept"/"Decline"
  actions per row. Accepting creates a conversation.

**Tab 3 — Co-ordinations**
- List of accepted connections. Tapping opens the chat thread for that
  connection (Tab 4 content, but reachable from here too).

**Tab 4 — Chats**
- Conversation list (most recent first, unread badge count).
- Chat thread screen: message bubbles, text input, send button, typing
  indicator, real-time message delivery. A "chat limit" gate for free users
  who've exhausted their allowance, routing to the Plus paywall.

**Profile (reachable from a persistent account menu/avatar, not a tab)**
- Identity card: avatar, name, phone (masked), Plus badge if applicable.
- Sections: About (name/gender), Exam centre (state/district/centre), Travel
  & stay, Roll-number verification (submit application number → pending/
  verified/rejected states), Privacy & account actions (pause profile,
  blocked users list, delete account, log out).
- Single "Edit profile" toggle switches all sections into inline edit mode.

**Zenter Plus (paywall)**
- Price display (server-driven, do not hardcode), feature comparison
  (unlimited chats/reveals vs free tier limits), coupon code entry field,
  "Get Zenter Plus" CTA.
- **Do not implement payment logic client-side.** All pricing, coupon
  validation, order creation, and payment verification must go through
  server-side endpoints (see Backend section) — the app only displays what
  the server returns and triggers the Razorpay checkout SDK with a
  server-issued order.

**Blocked users** — list of users you've blocked, with an unblock action.

**Static/legal screens** — Terms and Conditions, Privacy Policy, Community
Guidelines, Refund & Cancellation Policy, FAQ, Contact Us. Simple scrollable
text screens, in-app.

## Backend integration

Use **Supabase** (Postgres + Auth + Realtime + Edge Functions) as the entire
backend — no custom server needed beyond Supabase Edge Functions for
payment/admin logic.

**Auth: use Supabase phone-OTP auth, not Firebase.** (Do not implement
Firebase Phone Auth — it requires reCAPTCHA, which does not work reliably
inside a Capacitor WebView on native platforms, and this app must work
natively from day one.) Flow: `supabase.auth.signInWithOtp({ phone })` →
`supabase.auth.verifyOtp({ phone, token, type: 'sms' })` → session persists
automatically. Use Supabase's session as the single source of truth for
`auth.uid()` so Row Level Security policies can scope every read/write to
the signed-in user.

**Core tables to model** (design RLS so users can only read/write their own
rows, and can only read other users' *non-sensitive* fields via a public-safe
view — never expose raw phone numbers, roll numbers, or device fingerprints
to the client for other users):
- `users` — profile fields listed in Onboarding above, plus `plus_member`,
  `is_verified_aspirant`, `role`, `account_status`, `contact_reveals_used`.
- `connections` — `sender_id`, `receiver_id`, `status` (pending/accepted).
- `conversations` — linked to an accepted connection, two participants.
- `messages` — `conversation_id`, `sender_id`, `body`, `created_at`; use
  Supabase Realtime (`postgres_changes` subscription) for live delivery.
- `blocked_users` — `blocker_user_id`, `blocked_user_id`.
- `coupons`, `platform_config` — admin-managed pricing/config; read via a
  public-safe view, never expose admin-only columns to the client.

**Payments (Razorpay):** implement via two Supabase Edge Functions —
`create-razorpay-order` (validates coupon server-side, creates the Razorpay
order, returns `order_id`/`key_id`/amount) and `verify-razorpay-payment`
(recomputes the HMAC signature server-side against the stored secret, and
only then grants Plus). Never put the Razorpay key secret in client code.
Trigger the native Razorpay checkout flow (their JS SDK works inside
Capacitor via the in-app browser/WebView bridge, or use a Razorpay Capacitor
plugin if available) after receiving the order from the edge function.

**Suspension handling:** on every authenticated screen load, check the
current user's `account_status`. If `suspended`, show a full-screen blocking
overlay with a support-contact action and sign-out — do not render the app
underneath it.

## Non-functional requirements

- Native bottom tab bar with badge counts (unread chats, pending requests).
- Loading skeletons/spinners for all network-dependent screens — never a
  blank white flash.
- Android hardware back button integrates with the in-app screen stack.
- App icon and splash screen should use Zenter's brand mark (the "Z" square
  logomark on the primary orange background).
- Push-notification readiness is a plus but not required for v1.
- All forms must have inline validation matching the current web app's rules
  (10-digit Indian mobile numbers, required onboarding fields, etc.).

## Explicitly out of scope for this mobile build

- The **admin panel** is an internal web-only tool — do not include it in
  the mobile app.
- Do not load any part of the live zenter.in website inside a WebView/iframe
  at any point, including for the legal/static pages.
- Do not implement Firebase Auth or reCAPTCHA anywhere in this build.

## Deliverable

A single Capacitor-wrapped React app that:
1. Builds and runs identically on iOS and Android via `npx cap run ios` /
   `npx cap run android`.
2. Contains zero separate HTML pages beyond the single app shell entry point.
3. Matches Zenter's existing visual design pixel-for-pixel in spirit (colors,
   type, spacing, component shapes) while every screen is a real in-app
   screen with full client-side navigation and complete functionality (not
   a placeholder or mock).
