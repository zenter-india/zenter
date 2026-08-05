# IDFA / Tracking / ATT Audit

## Search performed

Searched `package.json` dependencies and the full `app/`/`src/` source tree for:
- `IDFA`, `AdSupport`, `AppTrackingTransparency`, `ATTrackingManager`
- Known ad SDKs (AdMob, Facebook Audience Network, AppLovin, Unity Ads, ironSource, etc.)
- Known attribution SDKs (Adjust, AppsFlyer, Branch, Kochava, Singular)
- Known cross-app analytics/ad-adjacent SDKs (Facebook SDK, TikTok SDK, Google Analytics/Firebase Analytics)

**Result: none found.** `package.json`'s full dependency list (see `PRODUCTION_CONFIG_AUDIT.md`) contains no
advertising, attribution, or cross-app-tracking SDK. The only analytics present is a first-party
`analytics_events` Supabase table populated by `src/lib/observability.ts`'s `track()` — events stay inside
Zenter's own database, are never sent to a third-party ad network, and are not used to track the user across
other companies' apps or websites (Apple's specific definition of "tracking" for ATT purposes).

Firebase is present in the dependency tree (`@react-native-firebase/app`, `@react-native-firebase/auth`) but
only for the (now-unused, flagged in `APP_PRIVACY.md`) legacy Auth integration — not Firebase Analytics, not
Firebase's ad-attribution products. No `@react-native-firebase/analytics` or `@react-native-firebase/*ads*`
package is present.

## Conclusion

**AppTrackingTransparency (ATT) is not required.** Do not add the ATT permission or `NSUserTrackingUsageDescription`
— adding it without an actual tracking use case would itself be inaccurate and could draw unnecessary review
scrutiny for a permission the app doesn't use.

## App Store Connect answer

> **Do you use the Advertising Identifier (IDFA)?** → **No**
