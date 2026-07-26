# Zenter — React Native App

Native **Android + iOS** client for [Zenter](https://zenter.in), the roommate-matching
app for Indian medical-exam aspirants (NEET UG, NEET PG, FMGE, UPSC CMS, INICET,
NEET MDS, NEET SS).

Built with **Expo SDK 57** (custom dev client) + **Expo Router** + **TypeScript
(strict)**. It talks to the same production backend as the website — Supabase for
data, Firebase for phone-OTP authentication — so nothing needs to be provisioned
before you can run it.

This repository contains **only** the mobile app. The website and its Capacitor
shell live in a separate repository.

---

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| **Node.js** | 20 LTS or newer | everything |
| **npm** | 10+ (ships with Node 20) | everything |
| **Git** | any recent | everything |
| **JDK** | **17 or 21** — the JBR bundled with Android Studio works | Android builds |
| **Android Studio** | Ladybug or newer, with Android SDK 35 + platform-tools | Android builds |
| **Xcode** | 16 or newer, plus CocoaPods (`sudo gem install cocoapods`) | iOS builds (**macOS only**) |

Set `JAVA_HOME` to that JDK and make sure `adb` is on your `PATH` (Android
Studio → SDK Manager installs it under `platform-tools/`). Gradle will **not**
work on JDK 24+.

```bash
# Example, using Android Studio's bundled JBR
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"   # macOS
setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"                     # Windows
```

> **This app cannot run in Expo Go.** It uses native modules (Firebase Auth,
> Reanimated, Razorpay), so it needs a custom **dev client** — see §3.

---

## 2. Clone and install

```bash
git clone <this-repo-url> zenter-react-native-app
cd zenter-react-native-app

npm install

# Copy the environment file (values are already filled in — no editing needed)
cp .env.example .env        # macOS / Linux
copy .env.example .env      # Windows
```

Verify the checkout is healthy before building anything:

```bash
npm run typecheck   # tsc --noEmit  → expect zero errors
npm test            # jest          → expect 26/26 passing
npm run lint        # expo lint     → expect 0 errors, 0 warnings
```

### What `.env` contains

Only the Supabase **publishable (anon)** URL and key. These are designed to be
shipped inside the app binary and are protected server-side by Postgres Row
Level Security, so they are pre-filled in `.env.example`. The Firebase native
config files are already committed under [`config/`](config/) — see
[config/README.md](config/README.md) for why that is safe.

Nothing secret is stored in this repo.

---

## 3. Run the app

The native `android/` and `ios/` folders are **not** committed. They are
generated from [`app.config.js`](app.config.js) — this is Expo's *prebuild*
workflow, and it means the native projects can never drift from the config.

Generate them once after cloning:

```bash
npx expo prebuild
```

Re-run `npx expo prebuild --clean` any time you change `app.config.js`, add a
native dependency, or hit a stale-native-state problem.

### Android

```bash
# Plug in a device with USB debugging on, or start an emulator, then:
npm run android          # expo run:android — builds, installs, and launches
```

The first build downloads Gradle dependencies and takes 10–20 minutes. Later
builds take about a minute.

### iOS (macOS only)

```bash
cd ios && pod install && cd ..
npm run ios              # expo run:ios
```

Use a **real device** for anything involving OTP login — see §6.

### Day-to-day development

Once the dev client is installed on the device, you don't need to rebuild for
JavaScript changes:

```bash
npm start                # expo start --dev-client
```

Press `a` for Android or `i` for iOS, or scan the QR code from the dev client.

---

## 4. Cloud builds with EAS (no local Android Studio / Xcode needed)

The project is already wired to the Expo project
`fbfc260c-a95f-4ac8-a9a7-c1dae28fe630` (see [`app.json`](app.json)) with three
profiles in [`eas.json`](eas.json).

```bash
npm install -g eas-cli
eas login                                        # Expo account with access to the project

eas build --profile development --platform android   # installable dev client
eas build --profile preview      --platform android  # standalone APK for testers
eas build --profile production   --platform android  # AAB for the Play Console
eas build --profile production   --platform ios      # IPA for App Store Connect
```

| Profile | Output | Use |
|---|---|---|
| `development` | dev client, internal distribution | daily development against Metro |
| `preview` | **APK**, internal distribution | hand to testers — installs directly, no store |
| `production` | **AAB** / IPA, auto-incrementing version | Play Console / App Store submission |

The `preview` and `production` profiles already carry the Supabase config in
their `env` blocks, so cloud builds need no extra secrets.

### Submitting to the stores

```bash
eas submit --profile production --platform android
eas submit --profile production --platform ios
```

Android submission needs a Google Play service-account JSON; iOS needs App Store
Connect credentials. Neither is in this repo — supply them as EAS credentials.

---

## 5. Project layout

```
.
├── app/                    # Expo Router routes — the screen tree, file = route
│   ├── _layout.tsx         # root: providers, session gate, config-error screen
│   ├── (auth)/             # sign-in + OTP
│   ├── (drawer)/           # authenticated shell
│   │   ├── (tabs)/         # Find · Requests · Connections · Chats
│   │   └── faq, terms, privacy, contact, refund-policy, community
│   ├── chat/[id].tsx       # conversation
│   ├── mate/[id].tsx       # profile detail
│   └── onboarding, profile, filters, plus, settings, blocked, suspended…
│
├── src/
│   ├── api/                # every Supabase call lives here, and only here
│   ├── data/               # TanStack Query hooks + cache keys
│   ├── domain/             # pure business rules (matching, gating, masking,
│   │                       #   relationships, location) — no I/O, unit-tested
│   ├── features/           # feature modules: auth, chat, connections, feed,
│   │                       #   exchange, onboarding, payments, profile, safety
│   ├── components/         # shared UI primitives (Button, Card, Text, …)
│   ├── stores/             # client-side state (session, nav badges)
│   ├── theme/              # design tokens
│   └── lib/                # env, storage, haptics, observability
│
├── __tests__/              # Jest unit tests over src/domain and payments
├── assets/                 # app icon + adaptive icon
├── config/                 # Firebase native config (see config/README.md)
├── app.config.js           # THE source of truth for native config
├── eas.json                # build profiles
└── babel.config.js  tsconfig.json  eslint.config.js
```

**Conventions worth knowing:**

- Path alias `@/…` maps to `src/…`.
- All database access goes through `src/api/*` — never call Supabase from a screen.
- `src/domain/*` is pure and side-effect-free; that's where the unit tests point.
- `AsyncBoundary` (in `src/components`) renders the loading / error / empty
  states uniformly across screens.

---

## 6. Testing on real devices — read this before you file a bug

**Phone OTP login will fail on a locally-built Android app until you register
your machine's debug signing key with Firebase.** Firebase phone auth verifies
the app via its signing certificate, and your local debug keystore is not the
one used for the EAS builds.

```bash
# From the project root after `npx expo prebuild`:
cd android && ./gradlew signingReport      # look for Variant: debug → SHA1 / SHA-256
```

Add both the SHA-1 and SHA-256 to **Firebase console → Project `new-hallmate` →
Project settings → Your apps → Android `in.zenter.app` → Add fingerprint**, then
rebuild. Builds produced by `eas build` are already signed with a registered
key, so if you want to skip this step entirely, test with a `preview` APK from
EAS instead.

**On iOS, use a real device with a real phone number.** Firebase phone auth on
iOS goes through APNs / reCAPTCHA; the Simulator cannot receive the silent push,
and Firebase *test* numbers bypass the exact code path most likely to break.

**Other notes:**

- The app runs against **production** Supabase. Accounts you create and
  connection requests you send are real and visible to real users. Prefer a
  dedicated test phone number, and clean up afterwards.
- Zenter Plus checkout sits behind a provider seam
  (`src/features/payments/`) — Razorpay and Google Play Billing are both
  implemented, selected by remote config. Payment verification is handled by
  Supabase Edge Functions in the backend repo, not here.
- Push notifications are delivered by a backend Edge Function; no extra client
  setup is needed.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Red "Missing config" screen on launch | `.env` is absent or empty — `cp .env.example .env`, then restart Metro with `npm start --clear` |
| `expo prebuild` fails on the Firebase plugin | `config/google-services.json` or `config/GoogleService-Info.plist` is missing — they ship with this repo, so restore them from git |
| Gradle fails with an "Unsupported class file major version" or JDK error | You are not on JDK 17. Check `java -version` and `JAVA_HOME`. |
| `SDK location not found` | Set `ANDROID_HOME`, or create `android/local.properties` with `sdk.dir=/path/to/Android/Sdk` |
| OTP never arrives on a local Android build | Debug SHA-1 not registered in Firebase — see §6 |
| Metro serves stale JavaScript | `npx expo start --clear` |
| Native state is corrupt after a dependency change | `npx expo prebuild --clean` then rebuild |
| Dependency versions drift from the SDK | `npx expo install --fix` |
| General health check | `npx expo-doctor` |

Two warnings during `expo prebuild` are expected and harmless:

- `[@sentry/react-native/expo] Missing config for organization, project` — Sentry
  is intentionally unconfigured; `eas.json` sets `SENTRY_DISABLE_AUTO_UPLOAD=true`
  so builds succeed. Supply `SENTRY_ORG`, `SENTRY_PROJECT` and
  `SENTRY_AUTH_TOKEN` as EAS secrets and remove that flag to enable crash
  reporting with readable stack traces.
- `userInterfaceStyle: Install expo-system-ui in your project to enable this
  feature` — the app is designed light-only and renders correctly regardless;
  installing `expo-system-ui` would additionally force the system UI to light.

---

## 8. Backend

The app is a client only. The Supabase project (`wppuzqaigtffcpuvjolt`) holds the
schema, Row Level Security policies, RPCs, and Edge Functions — including
payment verification and push delivery. Database migrations and Edge Function
source live in the main Zenter repository. If a screen returns an unexpected
error, check whether a pending migration has been applied to production before
looking for a client bug.
