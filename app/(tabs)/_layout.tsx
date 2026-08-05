import { Tabs } from 'expo-router';
import { TabBar } from '@/components';
import { ConnectionsBadge } from '@/features/connections/ConnectionsBadge';
import { ChatsBadge } from '@/features/chat/ChatsBadge';

/**
 * Bottom-tab shell (FR-32, AD-3). Order: Requests · Find · Co-ordinations · Chats.
 * Uses the custom {@link TabBar} dock (spring press + active pill + safe-area
 * height) instead of the default bar, whose Android ripple clipped on this bar.
 */
export default function TabsLayout() {
  return (
    <>
      {/* Headless: keep the Requests + Chats tab badges live regardless of active tab (FR-15/FR-19). */}
      <ConnectionsBadge />
      <ChatsBadge />
      <Tabs
        initialRouteName="feed"
        tabBar={(props) => <TabBar {...(props as any)} />}
        // 'shift' crossfades between screen snapshots and can flash blank when the
        // destination tab hasn't rendered content yet (lazy mount + in-flight
        // fetch) — 'fade' is a softer transition that doesn't expose that gap.
        screenOptions={{ headerShown: false, animation: 'fade', lazy: false }}
      >
        <Tabs.Screen name="requests" />
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="connections" />
        <Tabs.Screen name="chats" />
      </Tabs>
    </>
  );
}
