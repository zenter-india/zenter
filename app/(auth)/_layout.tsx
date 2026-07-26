import { Stack } from 'expo-router';

/**
 * Auth stack (Story 2.1). Sign-in → OTP. Header hidden (the screens render their
 * own brand chrome). Navigation into the app on success uses `router.replace`, so
 * auth never remains in the back stack (FR-3).
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
