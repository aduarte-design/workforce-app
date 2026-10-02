import React, { useEffect, useRef } from 'react';
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { LogBox, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { schedulePausaActivaNotifications } from "@/src/utils/pausaNotifications";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync();

function AppShell() {
  const [loaded, error] = useIconFonts();
  const { user } = useAuth();
  const router = useRouter();
  const scheduledOnce = useRef(false);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // Schedule daily "Pausas Activas" notifications once the user is logged in.
  useEffect(() => {
    if (!user || scheduledOnce.current || Platform.OS === 'web') return;
    scheduledOnce.current = true;
    schedulePausaActivaNotifications().then((res) => {
      if (!res.scheduled) {
        console.log('[pausas] notifications not scheduled:', res.reason);
      }
    });
  }, [user]);

  // Handle taps on notifications → deep link into /pausas
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = (response.notification.request.content.data as any)?.screen;
      if (typeof screen === 'string' && screen.length > 0) {
        try {
          router.push(screen as any);
        } catch (e) {
          console.warn('[pausas] failed to open screen', screen, e);
        }
      }
    });
    return () => sub.remove();
  }, [router]);

  if (!loaded && !error) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pausas" />
      <Stack.Screen name="cumpleanos" />
      <Stack.Screen name="ausentes" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
