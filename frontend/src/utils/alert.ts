import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

/**
 * Web-safe wrapper around Alert.alert.
 * - On native (iOS/Android): uses the native Alert
 * - On web: falls back to window.alert / window.confirm so callbacks still fire
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons as any);
    return;
  }

  const fullMsg = message ? `${title}\n\n${message}` : title;

  // No buttons or single button: use alert()
  if (!buttons || buttons.length === 0) {
    if (typeof window !== 'undefined') window.alert(fullMsg);
    return;
  }

  if (buttons.length === 1) {
    if (typeof window !== 'undefined') window.alert(fullMsg);
    try { buttons[0].onPress?.(); } catch {}
    return;
  }

  // Multiple buttons: use confirm() - OK = last action (non-cancel), Cancel = cancel button
  const cancelBtn = buttons.find(b => b.style === 'cancel');
  const confirmBtn = buttons.find(b => b.style !== 'cancel') || buttons[buttons.length - 1];

  if (typeof window !== 'undefined') {
    const ok = window.confirm(fullMsg);
    if (ok) {
      try { confirmBtn?.onPress?.(); } catch {}
    } else {
      try { cancelBtn?.onPress?.(); } catch {}
    }
  }
}
