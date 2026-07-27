// gesture-handler must be the FIRST import in the app entry (before navigation).
// Imported by name rather than as a bare side-effect import so this single
// statement both registers the side effect and provides the root view.
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// url-polyfill MUST be imported before any Supabase usage (RN has no global URL).
import 'react-native-url-polyfill/auto';

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { envConfigError } from '@/lib/env';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ToastProvider } from '@/components';
import { QueryProvider } from '@/data/QueryProvider';
import { SessionProvider } from '@/stores/session';
import { initObservability } from '@/lib/observability';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { DeepLinkCapture } from '@/features/auth/DeepLinkCapture';
import { SafetyReminderHost } from '@/features/connections/SafetyReminder';
import { SuspensionGate } from '@/features/safety/SuspensionGate';

SplashScreen.preventAutoHideAsync().catch(() => {});
initObservability();

/**
 * Root layout (AD-3). Bundles brand fonts (AD-7) and hosts the global toast.
 * The bottom-tab navigator + gate screens are added in Stories 1.3 / 1.5.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useForegroundRefresh();

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  // Missing Supabase config (dev setup / EAS secrets not wired). Shown instead
  // of the app rather than letting every screen fail with an opaque network
  // error against the placeholder client (see src/lib/env.ts, src/api/client.ts).
  if (envConfigError) {
    return (
      <View style={styles.configErrorWrap}>
        <Text style={styles.configErrorTitle}>Configuration error</Text>
        <Text style={styles.configErrorBody}>{envConfigError}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <QueryProvider>
      <SessionProvider>
      <ToastProvider>
        {/* Dark status-bar content — the app is light-themed with light headers. */}
        <StatusBar style="dark" />
        <DeepLinkCapture />
        {/* Accept-flow safety reminder (FR-29): rendered once, shown from any surface. */}
        <SafetyReminderHost />
        {/* Root suspension guard (FR-30/FR-31): enforces the suspended lockout +
            one-time restore warning on fetch and foreground, across every surface. */}
        <SuspensionGate />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 260, gestureEnabled: true }}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          {/* Exam gate (Story 3.1): full-screen, unbypassable — no back gesture. */}
          <Stack.Screen name="maintenance" options={{ gestureEnabled: false }} />
          <Stack.Screen name="chat/[id]" />
          {/* Self-profile + settings (Epic 6): pushed screens over the tabs. */}
          <Stack.Screen name="profile" />
          <Stack.Screen name="settings" />
          {/* Zenter Plus subscription screen (payment + coupon + comparison). */}
          <Stack.Screen name="plus" />
          {/* Blocked users list (Story 8.2): pushed screen from Profile. */}
          <Stack.Screen name="blocked" />
          {/* Suspended lockout (Story 8.3): full-screen, unbypassable — no back gesture. */}
          <Stack.Screen name="suspended" options={{ gestureEnabled: false }} />
          {/* Overlays → native presentations (FR-34): profile preview + filters as sheets */}
          <Stack.Screen name="mate/[id]" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6, 1] }} />
          <Stack.Screen name="filters" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 0.9] }} />
          <Stack.Screen name="feedback" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 0.9] }} />
          <Stack.Screen name="faq" />
          <Stack.Screen name="contact" />
          {/* Long-form policy pages, mirroring the website's footer links. */}
          <Stack.Screen name="privacy" />
          <Stack.Screen name="terms" />
          <Stack.Screen name="community" />
          <Stack.Screen name="refund" />
        </Stack>
      </ToastProvider>
      </SessionProvider>
      </QueryProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  configErrorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8, backgroundColor: '#fff' },
  configErrorTitle: { fontSize: 18, fontWeight: '700', color: '#B3261E' },
  configErrorBody: { fontSize: 14, color: '#444', textAlign: 'center' },
});
