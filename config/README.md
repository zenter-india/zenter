# config/ — Firebase native configuration

These two files bind the app to the Firebase project **`new-hallmate`** under the
bundle/package identity **`in.zenter.app`**, which is what powers phone-number
OTP sign-in:

| File | Platform |
|---|---|
| `google-services.json` | Android |
| `GoogleService-Info.plist` | iOS |

They are referenced from [`app.config.js`](../app.config.js) via
`android.googleServicesFile` / `ios.googleServicesFile`, and are consumed by
`npx expo prebuild` when it generates the native projects. **Without them the
prebuild and every native build fail**, so they are committed to this repo.

## Are these secret?

No. Both files are designed to be embedded in the shipped app binary — anyone
can extract them from a published APK or IPA. The API key inside is not a
credential; access is gated in the Firebase console by package name +
signing-certificate SHA-1 for Android, and by bundle ID for iOS.

The things that *are* secret and must never be committed: the Supabase service
role key, the Android upload/signing keystore, the App Store Connect API key,
and any Razorpay secret. None of them live in this repo.

## Overriding for CI

Set `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST` to a different path (for
example a file materialised from an EAS secret) and `app.config.js` will use
that instead.
