# Payments Audit — Zenter Plus

## What is actually purchased

**Zenter Plus** (`app/plus.tsx`, `src/features/payments/`) is the only paid product in the app. It is a
one-time purchase (₹199 today, live-configured via `platform_config.plus_price_paise` in Supabase — currently
`19900` paise) that unlocks, **inside the app, forever** (no expiry logic found anywhere in the codebase):

- Featured/gold profile card + priority placement in the Find Aspirants feed
- Unlimited "contact exchange" reveals (free tier: 2, per `platform_config.free_reveal_limit`)
- Unlimited active co-ordinations/chats (free tier: 2, per `platform_config.free_active_chats`)
- A `⭐ Plus` badge

This is **digital content/functionality unlocked entirely within the app** — no physical goods, no real-world
service performed by another person off-platform, no real-time person-to-person service. It is precisely the
kind of purchase Apple's App Store Review Guideline 3.1.1 (In-App Purchase) requires to go through StoreKit
when bought inside an iOS app.

## Current payment provider (verified live)

`src/features/payments/index.ts` resolves the active gateway from `platform_config.payment_provider`, falling
back to `DEFAULT_PAYMENT_PROVIDER = 'razorpay'` if that key is unset.

**Live Supabase check (this session): `platform_config` has no `payment_provider` row at all.** There is no
platform split — iOS and Android both currently resolve to Razorpay, via `react-native-razorpay`
(`src/features/payments/razorpayProvider.ts`), which opens Razorpay's native checkout sheet directly inside
the app on **any** platform, iOS included.

There is a scaffolded `play_billing` provider (`src/features/payments/playBillingProvider.ts`) for Android —
explicitly documented in its own header as **NOT YET ACTIVE** (missing the `react-native-iap` native module,
a Play Console product, and a `verify-play-purchase` Edge Function). It has no iOS/StoreKit equivalent at all;
no `react-native-iap`/StoreKit code path exists anywhere in the repository for iOS.

## Classification

| Purchase | Type | Off-platform / real-world? | Apple IAP required? |
|---|---|---|---|
| Zenter Plus | Digital feature unlock (profile boost, unlimited reveals/chats) | No | **Yes** |

## Verdict

**RELEASE BLOCKER / OWNER DECISION REQUIRED.**

Shipping Build 10 as-is means an iOS user can tap "Get Zenter Plus," pay ₹199 via Razorpay's native sheet, and
have `users.plus_member` flipped server-side — entirely bypassing Apple's IAP system for a digital unlock.
This is one of the most consistently and quickly enforced App Review rejections (Guideline 3.1.1) and, if
somehow missed at review, is also grounds for later app removal/account action if flagged post-approval.

This audit does **not** redesign the payment architecture (per your operating rules). Options, for you to
decide:

1. **Gate Razorpay checkout off iOS entirely for this release.** Set `platform_config.payment_provider` to a
   value the iOS build treats as "Plus purchase unavailable on iOS" (e.g. hide/disable the "Get Zenter Plus"
   button on iOS, or the `plus.tsx` screen shows an "unavailable on iOS yet" state). This is a small,
   low-risk code change — ships an iOS build with **no way to pay Apple's way around**, i.e. no purchase path
   at all on iOS. Slower to build (Apple StoreKit product setup + server-side receipt verification), but is
   the only path that keeps Razorpay on iOS.
2. **Build the StoreKit path before submitting.** Requires: `expo-in-app-purchases` (or `react-native-iap`
   with the iOS module), a subscription/non-consumable product configured in App Store Connect, and a new
   `verify-apple-purchase` Edge Function mirroring `verify-razorpay-payment`'s server-side-is-authoritative
   pattern. This is a real code change beyond a quick config flip — your instructions say not to make one
   without your sign-off, so it is not done here.
3. **Submit as-is and accept the rejection risk.** Not recommended — this is a near-certain rejection, not a
   maybe.

Nothing in this file changes payment code. It is the audit and recommendation only.
