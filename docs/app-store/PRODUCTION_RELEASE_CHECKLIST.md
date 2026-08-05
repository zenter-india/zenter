# Zenter iOS Production Release Checklist

Legend: **PASS** · **ACTION REQUIRED** · **RELEASE BLOCKER** · **OWNER CONFIRMATION REQUIRED**

## App Store Metadata
- [x] **PASS** — App name, subtitle, promotional text, description, keywords drafted and within character
      limits (`APP_STORE_METADATA.md`)
- [x] **PASS** — Support URL live and verified (`https://zenter.in/contact`)
- [x] **PASS** — Marketing URL live and verified (`https://zenter.in`)
- [ ] **OWNER CONFIRMATION REQUIRED** — Copyright line wording (year + entity format)

## Screenshots
- [ ] **ACTION REQUIRED** — Plan written (`SCREENSHOT_PLAN.md`); actual 1284×2778 PNGs not yet captured
      (requires either your manual capture, or explicit go-ahead to use the simulator for this)

## Build
- [ ] **RELEASE BLOCKER (superseded)** — Build 10's commit is the exact pre-payments-work git HEAD (`6c8e822`)
      — it contains none of the Apple IAP/Play Billing/Restore Purchases code. A new build is required; see
      `PAYMENTS_REVIEW.md`. New builds now underway.

## App Review
- [x] **PASS** — Reviewer sign-in confirmed live: Supabase Auth Test OTP `916363613007=123123` — see
      `APP_REVIEW_INFORMATION.md`
- [x] **PASS** — Review notes drafted, ready to paste (`APP_REVIEW_INFORMATION.md`)
- [ ] **OWNER CONFIRMATION REQUIRED** — Contact first/last name split, phone number to list

## Privacy
- [x] **PASS** — Data-collection map complete, code-verified (`APP_PRIVACY.md`)
- [ ] **OWNER CONFIRMATION REQUIRED** — Crash-data user-linkage confirmation (Sentry)
- [ ] **OWNER CONFIRMATION REQUIRED** — Location-data questionnaire answer, pending the policy-wording
      discrepancy flagged in `APP_PRIVACY.md`
- [ ] **ACTION REQUIRED** — Firebase SDK still compiled into the binary despite being functionally unused —
      decide whether to remove before this submission (`APP_PRIVACY.md`)

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
      + Restore Purchases built, code committed, both Edge Function secrets live. Not yet end-to-end tested
      with a Sandbox purchase — do that once the new build installs. (`PAYMENTS_REVIEW.md`)

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
- [ ] **NOT READY** — Two release blockers (reviewer sign-in, iOS payment compliance) must be resolved first
