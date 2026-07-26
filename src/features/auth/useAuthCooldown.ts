import { useState, useEffect, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/lib/storage';

export function useAuthCooldown() {
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Load initial cooldown
  useEffect(() => {
    let active = true;
    storage.getString(STORAGE_KEYS.authCooldown).then((val) => {
      if (!active || !val) return;
      const until = parseInt(val, 10);
      const now = Date.now();
      if (until > now) {
        setCooldownLeft(Math.floor((until - now) / 1000));
      } else {
        storage.remove(STORAGE_KEYS.authCooldown);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Tick down
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const interval = setInterval(() => {
      setCooldownLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          storage.remove(STORAGE_KEYS.authCooldown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownLeft]);

  const triggerCooldown = useCallback(async (minutes = 5) => {
    const ms = minutes * 60 * 1000;
    const until = Date.now() + ms;
    await storage.setString(STORAGE_KEYS.authCooldown, until.toString());
    setCooldownLeft(Math.floor(ms / 1000));
  }, []);

  const isCoolingDown = cooldownLeft > 0;
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const cooldownText = isCoolingDown ? `Please wait ${formatTime(cooldownLeft)}` : '';

  return { isCoolingDown, cooldownText, triggerCooldown };
}
