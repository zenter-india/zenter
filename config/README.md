# config/ — Android FCM configuration

`google-services.json` binds the Android build to the Firebase project
**`new-hallmate`** under the package identity **`in.zenter.app`**. It is kept
for one reason only: **Firebase Cloud Messaging is the Android delivery channel
for `expo-notifications`** (connection requests, chat messages, accepted
requests — see [`src/lib/pushNotifications.ts`](../src/lib/pushNotifications.ts)
and the `send-push-notification` Edge Function). No Firebase SDK is linked into
the app any more.

| File | Platform | Used for |
|---|---|---|
| `google-services.json` | Android | FCM push delivery |

Phone-number OTP sign-in does **not** go through Firebase. It is Supabase Auth,
with MSG91 delivering the SMS via the `send-sms-msg91` "Send SMS" hook — see
[`src/features/auth/phoneAuth.ts`](../src/features/auth/phoneAuth.ts). The iOS
`GoogleService-Info.plist` was deleted along with `@react-native-firebase/*`,
since iOS push goes straight to APNs and needs no Firebase file.

The file is referenced from [`app.config.js`](../app.config.js) via
`android.googleServicesFile` and consumed by `npx expo prebuild` when it
generates the native project, so it is committed to this repo.

## Is it secret?

No. It is designed to be embedded in the shipped APK — anyone can extract it
from a published build. The API key inside is not a credential; access is gated
in the Firebase console by package name + signing-certificate SHA-1.

The things that *are* secret and must never be committed: the Supabase service
role key, the Android upload/signing keystore, the App Store Connect API key,
the MSG91 auth key, and any Razorpay secret. None of them live in this repo.

## Overriding for CI

Set `GOOGLE_SERVICES_JSON` to a different path (for example a file materialised
from an EAS secret) and `app.config.js` will use that instead.
