const { withAppDelegate } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

/**
 * Wires APNs directly into Firebase Auth so iOS phone sign-in can verify the
 * device with a silent push instead of falling back to the reCAPTCHA web view.
 *
 * Why this is needed: ExpoAppDelegate (node_modules/expo/ios/AppDelegates/
 * ExpoAppDelegate.swift) implements all three remote-notification delegate
 * methods itself and forwards them ONLY to ExpoAppDelegateSubscriberManager.
 * Firebase Auth never sees them. So Firebase sends its silent verification
 * push, iOS delivers it, Expo's delegate swallows it, Firebase times out
 * waiting, and every sign-in falls back to reCAPTCHA — which is exactly the
 * observed behaviour, and why every Apple/Firebase-side config check (APNs
 * key, Push Notifications capability, aps-environment entitlement, bundle
 * IDs) came back correct.
 *
 * @react-native-firebase relies on GoogleUtilities' AppDelegate swizzling to
 * hook these methods automatically; that isn't winning against Expo's own
 * implementations here, so we override them explicitly and hand Firebase what
 * it needs:
 *   1. registerForRemoteNotifications() at launch, so a token is requested.
 *   2. setAPNSToken(...) on success, so Auth has the token to verify with.
 *   3. canHandleNotification(...) on receipt, so Auth can consume its own
 *      silent push before Expo's subscriber chain swallows it.
 * Failures are logged with a [ZenterAPNs] prefix — previously there was no
 * signal at all when registration failed, since iOS emits no log of its own
 * for these callbacks.
 *
 * The methods are `open func` on ExpoAppDelegate, so override + super is safe
 * and keeps Expo's subscriber chain working for everything else.
 *
 * This must be a config plugin rather than a direct ios/ edit: EAS Build
 * regenerates the native project from app.config.js on every build, so a raw
 * file edit under ios/ is silently discarded.
 */

// Must match app.config.js's APS_PRODUCTION_PROFILES — the APNs token type has
// to agree with the aps-environment entitlement the build is signed with, or
// the silent push goes to the wrong APNs environment and never arrives.
const APS_PRODUCTION_PROFILES = ['preview', 'playInternal', 'production'];

const withExplicitApnsRegistration = (config) => {
  return withAppDelegate(config, (config) => {
    const isProduction = APS_PRODUCTION_PROFILES.includes(process.env.EAS_BUILD_PROFILE);
    const tokenType = isProduction ? '.prod' : '.sandbox';

    // 1. FirebaseAuth import (the template only imports FirebaseCore).
    config.modResults.contents = mergeContents({
      tag: 'zenter-apns-import',
      src: config.modResults.contents,
      newSrc: 'import FirebaseAuth',
      anchor: /import FirebaseCore/,
      offset: 1,
      comment: '//',
    }).contents;

    // 2. Ask for a token at launch, right after Firebase is configured.
    config.modResults.contents = mergeContents({
      tag: 'zenter-apns-register',
      src: config.modResults.contents,
      newSrc: '    application.registerForRemoteNotifications()',
      anchor: /FirebaseApp\.configure\(\)/,
      offset: 1,
      comment: '//',
    }).contents;

    // 3. Hand the token / silent push to Firebase Auth, then let Expo's
    //    subscriber chain run as normal via super.
    const delegateMethods = [
      '',
      '  public override func application(',
      '    _ application: UIApplication,',
      '    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data',
      '  ) {',
      '    NSLog("[ZenterAPNs] registered, token bytes=%d", deviceToken.count)',
      `    Auth.auth().setAPNSToken(deviceToken, type: ${tokenType})`,
      '    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)',
      '  }',
      '',
      '  public override func application(',
      '    _ application: UIApplication,',
      '    didFailToRegisterForRemoteNotificationsWithError error: Error',
      '  ) {',
      '    NSLog("[ZenterAPNs] registration FAILED: %@", error.localizedDescription)',
      '    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)',
      '  }',
      '',
      '  public override func application(',
      '    _ application: UIApplication,',
      '    didReceiveRemoteNotification userInfo: [AnyHashable: Any],',
      '    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void',
      '  ) {',
      '    if Auth.auth().canHandleNotification(userInfo) {',
      '      NSLog("[ZenterAPNs] silent push consumed by FirebaseAuth")',
      '      completionHandler(.noData)',
      '      return',
      '    }',
      '    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)',
      '  }',
      '',
    ].join('\n');

    config.modResults.contents = mergeContents({
      tag: 'zenter-apns-delegate-methods',
      src: config.modResults.contents,
      newSrc: delegateMethods,
      anchor: /\/\/ Linking API/,
      offset: 0,
      comment: '//',
    }).contents;

    return config;
  });
};

module.exports = withExplicitApnsRegistration;
