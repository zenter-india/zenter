import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The one persistence module (AD-11). Namespaced keys; per-user data is suffixed
 * with the user id so accounts never leak across each other. Read-state is
 * device-local for v1 (cross-device sync is a deferred Open Question).
 */
const NS = 'zenter';

const key = (name: string, userId?: string) => (userId ? `${NS}:${name}:${userId}` : `${NS}:${name}`);

export const storage = {
  async getString(name: string, userId?: string): Promise<string | null> {
    return AsyncStorage.getItem(key(name, userId));
  },
  async setString(name: string, value: string, userId?: string): Promise<void> {
    await AsyncStorage.setItem(key(name, userId), value);
  },
  async getJSON<T>(name: string, userId?: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key(name, userId));
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  async setJSON(name: string, value: unknown, userId?: string): Promise<void> {
    await AsyncStorage.setItem(key(name, userId), JSON.stringify(value));
  },
  async remove(name: string, userId?: string): Promise<void> {
    await AsyncStorage.removeItem(key(name, userId));
  },
  /** Clear non-user-scoped session keys on logout (per-user keys are kept, matching web). */
  async clearSession(): Promise<void> {
    const all = await AsyncStorage.getAllKeys();
    const sessionKeys = all.filter((k) => k.startsWith(`${NS}:session`) || k.startsWith(`${NS}:profileCompleted`) || k.startsWith(`${NS}:pendingDeepLink`));
    if (sessionKeys.length) await AsyncStorage.multiRemove(sessionKeys);
  },
};

/** Well-known key names. */
export const STORAGE_KEYS = {
  session: 'session',
  profileCompleted: 'profileCompleted',
  pendingDeepLink: 'pendingDeepLink',
  authCooldown: 'authCooldown',
  chatLastRead: 'chatLastRead', // per-user
  connectionsSeen: 'connectionsSeen', // per-user
} as const;
