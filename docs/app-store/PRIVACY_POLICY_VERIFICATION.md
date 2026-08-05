# Privacy Policy — production URL + coverage check

**Live URL for App Store Connect**: `https://zenter.in/privacy` (verified reachable, HTTP 200 after redirect,
`<title>Privacy Policy - Zenter</title>`, effective date 02/06/2026, last updated 03/07/2026, during this
audit).

## Coverage check against what the app actually does

| Required topic | Covered in policy? | Notes |
|---|---|---|
| Authentication (phone OTP) | Yes | §4 "OTP Verification" — explicit, matches Twilio-Verify-backed Supabase Auth |
| Phone numbers | Yes | §5 "Mobile Number Privacy" — explains numbers are hidden until mutual connection, matches the app's masking behavior exactly |
| Profile information | Yes | §2A lists name, exam details, travel/accommodation preferences |
| User-generated content / messaging | Partially | §2C mentions "Contact support / Submit feedback / Report abuse / File complaints" but does not explicitly mention **in-app chat messages** as a collected data category, even though `messages` is a real table with real content. **OWNER ACTION REQUIRED**: consider adding chat messages explicitly to §2 for completeness, even though §6/§7 general language likely already covers it legally. |
| Payments | **Not mentioned at all.** No reference to Razorpay, Zenter Plus, or any payment processor anywhere in the fetched policy text. **OWNER ACTION REQUIRED**: this is a real gap — the app has a live paid feature (`Zenter Plus`) and a named payment processor handling card/UPI data, and the current policy is silent on it. This should be added before submission, independent of the platform-specific IAP issue in `PAYMENTS_REVIEW.md`. |
| Notifications | Not explicitly mentioned. Push notifications were added this development cycle (device tokens, notification content). **OWNER ACTION REQUIRED**: add a short section covering push-token collection and its purpose. |
| Analytics | Generic — §7B mentions "Analytics services" as a category of service provider, without naming one. Consistent with the app's first-party `analytics_events` table (not a named third-party analytics SDK), so this is arguably accurate as-is, but doesn't name Sentry either. |
| Third-party processors | Generic only — §7B lists categories ("Hosting services," "OTP delivery services," "Analytics services," "Security monitoring," "Technical support") without naming Supabase, Twilio, Razorpay, or Sentry specifically. Not itself a rejection risk (many policies use generic category language), but less precise than the DPDP Act's own spirit of specificity. |
| Account deletion | Not explicitly described as an in-app self-service flow — §9 discusses retention *after* deletion, implying deletion is possible, but doesn't say *how* a user initiates it. **OWNER ACTION REQUIRED**: add a sentence describing the in-app path (Profile → Privacy & account → Delete account) so the policy matches the real, verified flow in `ACCOUNT_DELETION.md`. |
| Data retention | Yes | §9 — 1 year post-deletion logs, 3 years for complaints |
| Contact details | Yes | §1 — support@zenter.in, registered office address, proprietor name |

## Recommendation

Three gaps are worth closing before/around this submission (not strictly App-Review-blocking on their own,
but real accuracy gaps against the shipping app, and the payments gap compounds the `PAYMENTS_REVIEW.md`
release blocker — Apple reviewers do sometimes cross-check a payment flow against its privacy disclosure):

1. Add a payments/Razorpay section.
2. Add a push-notifications section.
3. Add an explicit in-app account-deletion path description.

**This audit does not edit the live policy** — per your operating rules, legal-policy changes are shown, not
silently applied. The exact wording is an owner/legal call, not a code-derived fact this audit can safely
generate.

**Final URL to enter in App Store Connect**: `https://zenter.in/privacy`
