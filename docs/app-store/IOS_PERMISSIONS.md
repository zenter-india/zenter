# iOS Permissions Audit

Every permission-relevant key in `app.config.js`'s `ios.infoPlist`/`entitlements`, checked against actual
usage in the codebase.

| Permission / capability | Info.plist key | API/feature requiring it | Actually used? | Recommendation |
|---|---|---|---|---|
| Photo Library | `NSPhotoLibraryUsageDescription` = *"Zenter does not access your photo library."* | None — no image picker, no avatar upload (`Avatar` component renders text initials only, `src/components/Avatar.tsx`) | **No.** Present only because Apple's static binary scanner (ITMS-90683) flags the mere presence of the Photo Library API symbol, which comes from `@sentry/react-native`'s screenshot-attachment feature — that feature is off by default and never enabled in `src/lib/observability.ts`'s `Sentry.init()` | **Keep as-is.** The string is honest (says the dialog will never appear) and removing it would fail Apple's binary validation given the Sentry symbol is still linked. This is documented in-repo already and is the correct call, not an oversight. |
| Remote/Push Notifications | `UIBackgroundModes: ['remote-notification']` + `aps-environment` entitlement | `expo-notifications` (this dev cycle) for connection-request/chat-message push alerts; historically also used for Firebase Auth's silent-push device verification (now unused, see `APP_PRIVACY.md`'s Firebase flag) | **Yes**, for the new push-notification feature | Necessary and correctly scoped. No purpose-string prompt is needed for this one (push permission uses its own native system prompt, not an Info.plist usage string) — `registerForPushNotificationsAsync` in `src/lib/pushNotifications.ts` requests it explicitly and only when a user is signed in. |
| Camera | — (no key present) | None | No | Correctly absent — do not add |
| Microphone | — (no key present) | None | No | Correctly absent — do not add |
| Location | — (no key present) | None (self-reported text field only, see `APP_PRIVACY.md`) | No | Correctly absent — do not add |
| Contacts | — (no key present) | None | No | Correctly absent — do not add |
| Bluetooth | — (no key present) | None | No | Correctly absent — do not add |

## Verdict

**No unused permissions to remove, and no missing ones to add.** The only slightly unusual entry
(`NSPhotoLibraryUsageDescription` present but functionally dead) is already correctly justified in-repo and
should stay exactly as-is — removing it would break Apple's own static-scan requirement given the Sentry
symbol is still compiled in.
