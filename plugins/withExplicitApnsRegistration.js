const { withAppDelegate } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

/**
 * Explicitly calls `UIApplication.registerForRemoteNotifications()` on launch.
 *
 * @react-native-firebase/auth's phone-auth silent-push verification on iOS
 * is supposed to trigger this automatically via GoogleUtilities' AppDelegate
 * swizzling once Auth is first used. In practice (confirmed via live device
 * console logs — no didRegisterForRemoteNotifications event ever appears,
 * across a full launch-through-reCAPTCHA session, despite the aps-environment
 * entitlement, Push Notifications capability, and Firebase APNs key all being
 * independently verified correct), that automatic trigger doesn't fire in
 * this project's native setup. Calling it explicitly removes the dependency
 * on that swizzling working, so Firebase gets a real APNs token to silently
 * verify against instead of always falling back to the reCAPTCHA web view.
 *
 * This needs to be a config plugin (not a direct ios/ edit) because EAS Build
 * regenerates the native project from scratch on every build — a raw file
 * edit under ios/ would be silently discarded.
 */
const withExplicitApnsRegistration = (config) => {
  return withAppDelegate(config, (config) => {
    config.modResults.contents = mergeContents({
      tag: 'explicit-apns-registration',
      src: config.modResults.contents,
      newSrc: '    application.registerForRemoteNotifications()',
      anchor: /FirebaseApp\.configure\(\)/,
      offset: 1,
      comment: '//',
    }).contents;
    return config;
  });
};

module.exports = withExplicitApnsRegistration;
