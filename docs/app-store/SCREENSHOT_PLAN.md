# Screenshot Plan (iPhone 6.9" — 1284 × 2778 px portrait)

## Important note on screenshot generation

This audit is **plan-only** — it does not include actual captured PNGs. This session operates under a
standing instruction not to run the iOS Simulator (you're doing manual testing yourself), so I have not
launched the simulator to capture these. Two ways to get the actual files:

1. **You capture them manually** on a real device or simulator at the screens/steps below (Xcode's simulator
   screenshot shortcut, or a real iPhone's screenshot, then crop/resize to 1284×2778 if needed).
2. **Ask me explicitly to use the simulator** for this specific purpose, overriding the standing
   no-simulator instruction just for screenshot capture — I'll only do this if you say so directly.

Either way, `assets/app-store/ios/` has been created and is ready to receive the final files
(`01-find.png` … `06-profile.png` suggested naming below) once produced.

## Recommended sequence (6 screenshots)

Every screen listed actually exists and renders real UI — none of this is aspirational.

### 1 — Find (main value proposition)
- **Screen**: `app/(tabs)/feed.tsx`
- **Navigation**: sign in → complete onboarding → lands on Find tab by default (`initialRouteName="feed"`)
- **Headline**: "Find your exam centre mates"
- **Subheadline**: "Browse aspirants heading to your exact exam centre"
- **What must be visible**: the district results list with a few aspirant cards (travel/stay badges visible)
- **Auth/data required**: yes, signed in with a completed profile; district with seeded aspirants populated
  (use a district known to have seeded demo profiles, not an empty one)
- **Privacy-sensitive info to replace**: real names/phone fragments — use seeded/demo profiles only (never a
  real user's card), which the app already supports (`seeded_users`)

### 2 — Profile preview
- **Screen**: `app/mate/[id].tsx`
- **Navigation**: from Find, tap any aspirant card
- **Headline**: "See who's heading your way"
- **Subheadline**: "Travel plans, stay preferences, and more"
- **What must be visible**: the profile sheet with route timeline, badges, travel/stay chips, masked phone
  number with the lock note, Connect button
- **Auth/data required**: same as above
- **Privacy-sensitive info to replace**: seeded/demo profile only

### 3 — Requests
- **Screen**: `app/(tabs)/requests.tsx`
- **Navigation**: Requests tab, with at least one incoming request visible (send one from a second test/seeded
  account first, or capture the empty state if that's the honest current state — do not fabricate a request
  that doesn't exist)
- **Headline**: "Connect on your terms"
- **Subheadline**: "Accept or decline requests from other aspirants"
- **What must be visible**: an incoming request card with Accept/Decline actions

### 4 — Chats
- **Screen**: `app/(tabs)/chats.tsx` and/or `app/chat/[id].tsx`
- **Navigation**: Co-ordinations/Chats tab, open an active conversation
- **Headline**: "Plan your trip, together"
- **Subheadline**: "Chat directly once you've connected"
- **What must be visible**: a real (or demo) message thread — **use placeholder/demo conversation content
  only**, never a captured real user conversation, for privacy
- **Privacy-sensitive info to replace**: message content, avatar initials — use a demo account's own
  conversation with a seeded user

### 5 — Zenter Plus
- **Screen**: `app/plus.tsx`
- **Navigation**: header menu → Zenter Plus, or Profile → "Get Zenter Plus"
- **Headline**: "Stand out with Zenter Plus"
- **Subheadline**: "Featured profile, priority visibility, unlimited connections"
- **What must be visible**: the feature comparison list and/or the free-vs-plus card preview component
  already built into this screen (`PreviewCard`)
- **Note**: capture this screen regardless of the payments-provider release blocker in `PAYMENTS_REVIEW.md` —
  showing the feature/benefits screen doesn't require actually completing a purchase

### 6 — Profile / account
- **Screen**: `app/profile.tsx`
- **Navigation**: header menu → Profile
- **Headline**: "Your exam, your details"
- **Subheadline**: "Verified profile, travel plans, and privacy controls"
- **What must be visible**: identity card (avatar, name, Roll No verified badge), exam centre section
- **Privacy-sensitive info to replace**: use a demo/test account's own real name is fine here (it's *your*
  account being screenshotted, not another user's), but do not show a real phone number in full — the app
  already masks this by default in most surfaces; for the identity card specifically (which shows the
  account's own number, not masked, by design), use a test account's number, not a personal one

## Screenshot automation

**No screenshot automation currently exists in this repository** — no Fastlane `snapshot`/`Fastfile`, no
Detox/Maestro UI-test screenshot pipeline was found. Setting one up is a real infrastructure addition (new
dependency, new CI-adjacent config), which is outside a docs-and-audit-only pass. If you want a repeatable
pipeline for future releases, the standard Expo-compatible options are `fastlane snapshot` (needs native iOS
project access, which EAS-managed builds normally abstract away) or a Maestro flow that walks the 6 screens
above and captures at each step — happy to build either as a separate, explicitly-requested follow-up.

## Output location
```
assets/app-store/ios/
```
Directory created and ready; empty until screenshots are produced per the note at the top of this file.
