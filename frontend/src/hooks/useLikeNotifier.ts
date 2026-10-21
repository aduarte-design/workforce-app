/**
 * Shows a phone notification for new "Likes" while the app is open or
 * recently backgrounded (polls the in-app notifications feed).
 * Not a remote push: nothing arrives while the app is fully closed.
 */
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getNotifications } from '@/src/utils/api';
import { storage } from '@/src/utils/storage';

const POLL_MS = 20000;
const SEEN_KEY = 'likes_notified_ids';

async function hasPermission(): Promise<boolean> {
  const s = await Notifications.getPermissionsAsync();
  if (s.granted) return true;
  if (!s.canAskAgain) return false;
  const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return r.granted;
}

export function useLikeNotifier(userId?: string) {
  const seen = useRef<Set<string> | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const key = `${SEEN_KEY}_${userId}`;

    const check = async () => {
      if (busy.current || cancelled) return;
      busy.current = true;
      try {
        const list: any[] = await getNotifications();
        const likes = (list || []).filter((n) => n.type === 'kudo' && !n.read);
        if (seen.current === null) {
          // First run: mark everything that already exists as seen (no flood on login)
          const stored = await storage.getItem<string[]>(key, null as any);
          seen.current = new Set(stored || likes.map((n) => n._id));
          if (!stored) await storage.setItem(key, Array.from(seen.current));
        }
        const fresh = likes.filter((n) => !seen.current!.has(n._id));
        if (fresh.length && (await hasPermission())) {
          for (const n of fresh.slice(0, 3)) {
            await Notifications.scheduleNotificationAsync({
              content: { title: `❤️ ${n.title}`, body: n.message, data: { screen: '/(tabs)/kudos' } },
              trigger: null,
            });
          }
          if (fresh.length > 3) {
            await Notifications.scheduleNotificationAsync({
              content: { title: '❤️ Nuevos Likes', body: `Y ${fresh.length - 3} likes más en el equipo`, data: { screen: '/(tabs)/kudos' } },
              trigger: null,
            });
          }
        }
        fresh.forEach((n) => seen.current!.add(n._id));
        if (fresh.length) await storage.setItem(key, Array.from(seen.current!).slice(-200));
      } catch (e: any) {
        console.log('[likes] notifier check failed:', e?.message || e);
      } finally {
        busy.current = false;
      }
    };

    const start = () => {
      if (timer) return;
      check();
      timer = setInterval(check, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    start();
    const sub = AppState.addEventListener('change', (st) => (st === 'active' ? start() : stop()));
    return () => {
      cancelled = true;
      stop();
      sub.remove();
      seen.current = null;
    };
  }, [userId]);
}
