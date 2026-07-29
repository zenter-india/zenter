// Build profiles signed with a Distribution certificate (ad-hoc/internal APK-
// style installs, TestFlight, and the App Store all use one) — every other
// case, including local `expo prebuild`/Xcode debug runs where
// EAS_BUILD_PROFILE is unset, uses a Development certificate.
const APS_PRODUCTION_PROFILES = ['preview', 'playInternal', 'production'];

module.exports = ({ config }) => ({
  ...config,
  name: 'Zenter',
  slug: 'zenter',
  icon: './assets/icon.png',
  scheme: 'zenter',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'in.zenter.app',
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || './config/GoogleService-Info.plist',
    supportsTablet: false,
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      // Export-compliance answer for App Store Connect: the app only uses
      // standard OS-provided HTTPS/TLS (Supabase, Firebase) — no proprietary
      // encryption — so it's exempt. Without this key, App Store Connect asks
      // the encryption question manually on every submission.
      ITSAppUsesNonExemptEncryption: false,
      // ITMS-90683: Apple's static binary scan flags the mere presence of the
      // Photo Library API symbol and requires a purpose string regardless of
      // whether it's actually called. The app has no image-picker or avatar-
      // upload feature (Avatar renders initials only — see
      // src/components/Avatar.tsx) and never requests this permission; the
      // symbol comes from @sentry/react-native's screenshot-attachment
      // feature, which is off by default and not enabled anywhere in
      // src/lib/observability.ts's Sentry.init(). This string is honest: the
      // dialog it describes will never actually appear.
      NSPhotoLibraryUsageDescription: 'Zenter does not access your photo library.',
    },
    // Required for @react-native-firebase/auth's silent-push device
    // verification on iOS (the APNs equivalent of Android's Play Integrity
    // check) — without this entitlement the app never gets a valid APNs
    // device token, so Firebase can't silently verify the device and always
    // falls back to the reCAPTCHA web-view during phone sign-in.
    entitlements: {
      'aps-environment': APS_PRODUCTION_PROFILES.includes(process.env.EAS_BUILD_PROFILE) ? 'production' : 'development',
    },
  },
  android: {
    package: 'in.zenter.app',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './config/google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    [
      'expo-build-properties',
      {
        ios: { useFrameworks: 'static' },
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/icon.png',
        imageWidth: 200,
        backgroundColor: '#ffffff',
      },
    ],
    // Native crash reporting. DSN is read at runtime via EXPO_PUBLIC_SENTRY_DSN
    // in src/lib/observability.ts.
    //
    // Source-map upload is a RELEASE-BUILD GRADLE TASK and it HARD-FAILS when
    // SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN are absent — it does not
    // merely warn ("error: An organization ID or slug is required", EAS build
    // 62d032fe). eas.json therefore sets SENTRY_DISABLE_AUTO_UPLOAD=true so
    // builds succeed while Sentry is unconfigured. Remove that flag once the
    // three SENTRY_* values are supplied as EAS secrets.
    '@sentry/react-native/expo',
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    eas: {
      // The single source of truth is app.json's extra.eas.projectId — `eas
      // init`/`eas build` write it there directly (app.json is static config;
      // this file can't be auto-updated by EAS CLI since it's dynamic JS).
      // EAS_PROJECT_ID lets a specific command override it ad hoc without
      // touching either file. No hardcoded fallback: a stale literal here
      // previously pointed at a foreign, inaccessible EAS project
      // (fbfc260c-a95f-4ac8-a9a7-c1dae28fe630) whenever app.json's field was
      // ever absent — exactly the failure mode this is guarding against.
      projectId: process.env.EAS_PROJECT_ID || (config.extra && config.extra.eas && config.extra.eas.projectId),
    },
  },
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: process.env.EAS_UPDATE_URL,
  },
  experiments: {
    typedRoutes: true,
  },
});
