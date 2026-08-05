/**
 * Local scheduled notifications for the "Pausas Activas" feature.
 * - Fires daily at 11:00 and 16:00 device-local time (targeting Colombia UTC-5).
 * - On tap, the OS opens the /pausas route via expo-router deep linking.
 *
 * NOTE: In Expo Go (SDK 53+) local notification scheduling is limited on Android.
 * For full behavior the user should generate a native development / production build.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const PAUSA_MESSAGES = [
  '¡Hora de una pausa activa! Tu cuerpo te lo agradecerá 💪',
  'Momento de moverte un poco. Estira y recarga energía ✨',
  'Pausa activa: 2 minutos ahora ahorran horas de tensión después 🧘',
  'Tómate un respiro. Toca aquí para ver tu pausa recomendada 🌿',
];

// How the app should behave when a notification arrives while the app is foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) {
    // Simulators/emulators can still receive local notifications
    // but permission check is a no-op there.
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  if (!settings.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return req.granted;
}

const IDENTIFIERS = ['pausa-activa-morning', 'pausa-activa-afternoon'];

/**
 * Schedules two daily local notifications at 11:00 and 16:00 local time.
 * Safe to call multiple times: existing schedules are cancelled first.
 */
export async function schedulePausaActivaNotifications(): Promise<{ scheduled: boolean; reason?: string }> {
  if (Platform.OS === 'web') {
    return { scheduled: false, reason: 'web' };
  }

  try {
    const granted = await ensurePermission();
    if (!granted) return { scheduled: false, reason: 'permission-denied' };

    // Cancel any previous schedules with the same identifiers
    for (const id of IDENTIFIERS) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    }

    const pickMsg = () => PAUSA_MESSAGES[Math.floor(Math.random() * PAUSA_MESSAGES.length)];

    // Morning schedule
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIERS[0],
      content: {
        title: '🌿 Pausa activa de la mañana',
        body: pickMsg(),
        data: { screen: '/pausas', slot: 'morning' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 11,
        minute: 0,
      },
    });

    // Afternoon schedule
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIERS[1],
      content: {
        title: '🌿 Pausa activa de la tarde',
        body: pickMsg(),
        data: { screen: '/pausas', slot: 'afternoon' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 16,
        minute: 0,
      },
    });

    return { scheduled: true };
  } catch (err: any) {
    console.warn('[pausas] could not schedule notifications:', err?.message || err);
    return { scheduled: false, reason: err?.message || 'error' };
  }
}

export async function getScheduledPausasNotifications() {
  if (Platform.OS === 'web') return [];
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.filter((n) => IDENTIFIERS.includes(n.identifier));
}

export async function cancelPausaActivaNotifications() {
  if (Platform.OS === 'web') return;
  for (const id of IDENTIFIERS) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  }
}
