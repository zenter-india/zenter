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
      projectId: process.env.EAS_PROJECT_ID || (config.extra && config.extra.eas && config.extra.eas.projectId) || 'fbfc260c-a95f-4ac8-a9a7-c1dae28fe630',
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
