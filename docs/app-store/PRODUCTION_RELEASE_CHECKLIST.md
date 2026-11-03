# Zenter iOS Production Release Checklist

Legend: **PASS** · **ACTION REQUIRED** · **RELEASE BLOCKER** · **OWNER CONFIRMATION REQUIRED**

## App Store Metadata
- [x] **PASS** — App name, subtitle, promotional text, description, keywords drafted and within character
      limits (`APP_STORE_METADATA.md`)
- [x] **PASS** — Support URL live and verified (`https://zenter.in/contact`)
- [x] **PASS** — Marketing URL live and verified (`https://zenter.in`)
- [ ] **OWNER CONFIRMATION REQUIRED** — Copyright line wording (year + entity format)

## Screenshots
- [x] **PASS (captured, verify dimensions)** — 8 iOS PNGs in `screenshots_ios/` and 9 Android JPGs in
      `screenshots_android/`; confirm iOS files are 1284×2778 before upload (`SCREENSHOT_PLAN.md`)

## Build
- [ ] **ACTION REQUIRED** — Build 10 predates the IAP work and is superseded. `app.config.js` is now at
      `1.0.2` (uncommitted) because Apple closed the 1.0.0 and 1.0.1 pre-release trains (409). Commit the
      pending changes, then cut a fresh build from that commit and upload it.

## App Review
- [x] **PASS** — Reviewer sign-in confirmed live: Supabase Auth Test OTP `916363613007=123123` — see
      `APP_REVIEW_INFORMATION.md`
- [x] **PASS** — Review notes drafted, ready to paste (`APP_REVIEW_INFORMATION.md`)
- [ ] **OWNER CONFIRMATION REQUIRED** — Contact first/last name split (phone `+91 70104 41518` already
      drafted in `APP_REVIEW_INFORMATION.md`)
- [x] **PASS** — Phone-login OTP verified live through MSG91 on 2026-11-03 (two sends `Delivered`, template
      ZENTER_OTP, sender ZENTER). Required two fixes: the code must be sent as the `OTP` template variable in
      the JSON body (not an `otp` query param), and MSG91's API Security/IP whitelisting must stay off or
      every call is rejected with error 418
- [ ] **ACTION REQUIRED** — Reviewer OTP docs still say Twilio Verify; update `APP_REVIEW_INFORMATION.md` for
      MSG91 and re-confirm the test OTP `916363613007=123123` (Supabase test OTPs bypass SMS, so it should be
      unaffected)

## Privacy
- [x] **PASS** — Data-collection map complete, code-verified (`APP_PRIVACY.md`)
- [ ] **OWNER CONFIRMATION REQUIRED** — Crash-data user-linkage confirmation (Sentry)
- [ ] **OWNER CONFIRMATION REQUIRED** — Location-data questionnaire answer, pending the policy-wording
      discrepancy flagged in `APP_PRIVACY.md`
- [ ] **ACTION REQUIRED** — Firebase SDK (`@react-native-firebase/app` + `auth`) is still in `package.json`
      and `app.config.js` despite being functionally unused — decide whether to remove before this
      submission (`APP_PRIVACY.md`)

## Age Rating
- [x] **PASS** — Recommended answers drafted (`AGE_RATING.md`); final band is Apple's own computed output

## Export Compliance
- [x] **PASS** — `ITSAppUsesNonExemptEncryption: false` verified accurate (`EXPORT_COMPLIANCE.md`)

## Content Rights
- [x] **PASS** — No third-party content in the app (`CONTENT_RIGHTS.md`)

## Permissions
- [x] **PASS** — No unused permissions, no missing ones (`IOS_PERMISSIONS.md`)

## Account Deletion
- [x] **PASS** — In-app deletion verified end-to-end against live schema, including cascade behavior
      (`ACCOUNT_DELETION.md`)

## UGC Safety
- [x] **PASS** — Block, report-via-block-reason, published contact, and Terms/Community Guidelines all exist
      (`UGC_COMPLIANCE.md`)

## Payments
- [x] **PASS (implemented, pending real-purchase test)** — Real Apple IAP (StoreKit via `react-native-iap`)
      + Restore Purchases built and committed; `verify-apple-purchase` hardening (zero-row update, claimed
      transaction) is uncommitted and must be deployed. Still needs an end-to-end Sandbox purchase on the new
      build. (`PAYMENTS_REVIEW.md` is stale: it still describes the pre-IAP state)

## Production Environment
- [x] **PASS** — Single production Supabase project, no dev/staging leakage, no mock auth, no hard-coded
      secrets (`PRODUCTION_CONFIG_AUDIT.md`)
- [ ] **ACTION REQUIRED** (non-blocking) — Sentry source-map upload disabled; won't affect review, will affect
      your own post-launch crash triage

## Legal URLs
- [x] **PASS** — Privacy Policy live and verified (`https://zenter.in/privacy`)
- [x] **PASS** — Terms live and verified (`https://zenter.in/terms`)
- [ ] **ACTION REQUIRED** — Privacy Policy has three real content gaps vs. the shipping app (payments, push
      notifications, in-app deletion path not described) — `PRIVACY_POLICY_VERIFICATION.md`

## Final Submission
- [ ] **NOT READY** — Reviewer sign-in and iOS payment compliance are resolved in code; remaining: new
      build from committed code, Sandbox purchase test, privacy-policy gaps, and the owner confirmations above
