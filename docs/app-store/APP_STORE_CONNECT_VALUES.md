# App Store Connect — Copy/Paste Value Sheet

Fields in the order you'll hit them in App Store Connect → Distribution → iOS App → Version 1.0 → Prepare for
Submission. Every `OWNER INPUT REQUIRED` line means: do not guess, do not submit until it's filled.

---

## APP STORE VERSION
```
Version: 1.0
Build:   10 (1.0.0)
```

## PRODUCT PAGE
```
Promotional Text:
Connect with aspirants at your exact exam centre. Coordinate travel, share stays, and never face exam day alone.

Description:
[see APP_STORE_METADATA.md — 1,438 characters, paste verbatim]

Keywords:
exam,neet,coordination,centre,travel,aspirant,mates,study,inicet,student,partner,exam buddy

Support URL:
https://zenter.in/contact

Marketing URL:
https://zenter.in

Copyright:
OWNER INPUT REQUIRED — confirm exact wording, e.g. "2026 Amsel Gold" (entity name is verified: AMSEL GOLD,
proprietorship of Pon Buvaneshwaran; year format is your call)
```

## SCREENSHOTS
```
OWNER INPUT REQUIRED — not yet captured. Plan + exact sequence + navigation steps: SCREENSHOT_PLAN.md.
Target path once produced: assets/app-store/ios/01-find.png ... 06-profile.png
```

## APP REVIEW
```
Sign-in required: Yes

Username (phone number):
OWNER INPUT REQUIRED — RELEASE BLOCKER. No test OTP number is configured yet. Set one up in Supabase
Auth (Authentication → Providers → Phone → Test OTP numbers) for the production project, then put that
phone number here. See APP_REVIEW_INFORMATION.md for exactly why and how.

Password (fixed OTP code):
OWNER INPUT REQUIRED — the fixed code you assign to the test number above.

Contact first name:
OWNER INPUT REQUIRED — confirm split of "Pon Buvaneshwaran" (see APP_REVIEW_INFORMATION.md)

Contact last name:
OWNER INPUT REQUIRED — see above

Phone:
OWNER INPUT REQUIRED — confirm +91 6363613007 is the right number for Apple to call about this app

Email:
support@zenter.in

Review notes:
[see APP_REVIEW_INFORMATION.md for the full drafted text — paste verbatim once the payments paragraph
inside it is filled in]
```

## RELEASE METHOD
```
Recommended: Manually release this version
(so you control the exact release moment after Apple's approval, rather than an automatic release the
instant review passes — standard practice, not a code-derived requirement)
```

## APP PRIVACY
```
Data collected: Yes
  Contact Info → Name: Collected, linked, not used for tracking — App Functionality
  Contact Info → Phone Number: Collected, linked, not used for tracking — App Functionality
  User Content → Other User Content: Collected, linked, not used for tracking — App Functionality
  Identifiers → User ID: Collected, linked, not used for tracking — App Functionality
  Identifiers → Device ID: Collected, linked, not used for tracking — App Functionality (push)
  Usage Data → Product Interaction: Collected, linked, not used for tracking — Analytics
  Diagnostics → Crash Data: Collected, OWNER TO CONFIRM linkage — App Functionality
  Financial Info → Payment Info: OWNER INPUT REQUIRED — judgment call, see APP_PRIVACY.md
  Location: OWNER INPUT REQUIRED — pending policy-wording discrepancy, see APP_PRIVACY.md
  All others (Photos, Camera, Microphone, Contacts, Health, Browsing/Search History,
  Sensitive Info): Not Collected

Tracking: No, we do not track users
```

## AGE RATING
```
See AGE_RATING.md for the full question-by-question answers. Key ones:
  User-Generated Content: Yes
  Unrestricted Web Access: No
  Gambling/Contests: No
  All mature-content categories (sexual, violence, alcohol/drugs, medical, profanity): None
Apple computes the final band from these — likely 17+ given unrestricted UGC chat with reactive-only
moderation; confirm once entered.
```

## EXPORT COMPLIANCE
```
Uses encryption: Yes
Qualifies for exemption: Yes (standard HTTPS/TLS only, no proprietary cryptography)
ITSAppUsesNonExemptEncryption: false (already set in app.config.js — no change needed)
```

## CONTENT RIGHTS
```
Contains/displays/accesses third-party content: No
```

## ADVERTISING IDENTIFIER / TRACKING
```
Uses the Advertising Identifier (IDFA): No
```

---

## Fields that are OWNER INPUT REQUIRED — full list
1. Copyright exact wording
2. All 6 App Store screenshots (1284×2778 PNG)
3. App Review sign-in username (test phone number) — **RELEASE BLOCKER until set**
4. App Review sign-in password (fixed OTP code) — **RELEASE BLOCKER until set**
5. Contact first/last name split
6. Contact phone number confirmation
7. App Review notes' payments paragraph — **blocked on the payments release blocker below**
8. App Privacy → Financial Info judgment call
9. App Privacy → Location judgment call (pending the policy-wording fix)

## The one item that isn't a form field but blocks submission anyway
**Zenter Plus is sold via Razorpay on iOS with no Apple In-App Purchase path.** This isn't an App Store
Connect field — it's the app's actual purchase flow, and Apple's reviewer will find it by tapping "Get Zenter
Plus." See `PAYMENTS_REVIEW.md` for the three options and why none of them is applied automatically here.
