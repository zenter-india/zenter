/**
 * Expo push notifications: permission + token registration, Android channel
 * setup, and tap-to-navigate. One unified Expo push token covers both iOS
 * and Android — no raw FCM/APNs handling here.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { upsertDeviceToken } from '@/api/pushTokens';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Registers this device for push and upserts the token for `userId`. No-op on simulators. */
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const { error } = await upsertDeviceToken(userId, token, platform);
  if (error && __DEV__) console.warn('[push] token upsert failed', error.message);
}

type NotificationData = { type?: string; connection_id?: string; conversation_id?: string };

function navigateForData(data: NotificationData): void {
  if (data.type === 'connection_request') router.push('/(tabs)/requests');
  else if (data.type === 'connection_accepted') router.push('/(tabs)/connections');
  else if (data.type === 'chat_message' && data.conversation_id) router.push(`/chat/${data.conversation_id}`);
}

/** Routes a tapped notification to the relevant screen. Returns an unsubscribe fn. */
export function attachNotificationResponseListener(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateForData((response.notification.request.content.data ?? {}) as NotificationData);
  });
  return () => sub.remove();
}
