import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { changePassword } from '@/src/utils/api';
import { useAuth } from '@/src/contexts/AuthContext';

const GREEN = '#122c2a';
const GOLD = '#b68a2e';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user, clearMustChangePassword, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const forced = Boolean(user?.must_change_password);

  const alertMsg = (msg: string) => {
    if (Platform.OS === 'web') window.alert(msg);
    else setError(msg);
  };

  const handleSubmit = async () => {
    setError('');
    if (password.length < 6) {
      alertMsg('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== password2) {
      alertMsg('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await changePassword(password);
      await clearMustChangePassword();
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'No se pudo actualizar la contraseña';
      alertMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Only visible when NOT forced
    router.back();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <KeyboardAwareScrollView
            bottomOffset={32}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!forced && (
              <TouchableOpacity style={styles.backBtn} onPress={handleCancel}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
            )}

            <View style={styles.iconCircle}>
              <Ionicons name="key" size={32} color={GREEN} />
            </View>

            <Text style={styles.title}>
              {forced ? 'Crea tu nueva contraseña' : 'Cambiar contraseña'}
            </Text>

            {forced && (
              <View style={styles.notice}>
                <Ionicons name="shield-checkmark" size={18} color={GREEN} />
                <Text style={styles.noticeText}>
                  Entraste con una contraseña temporal. Por tu seguridad, debes crear una
                  contraseña nueva para continuar.
                </Text>
              </View>
            )}

            <Text style={styles.subtitle}>
              Debe tener al menos 6 caracteres. Usa una combinación segura que recuerdes.
            </Text>

            <Text style={styles.inputLabel}>Nueva contraseña</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color="#fff" style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!show}
                autoCapitalize="none"
                editable={!loading}
                testID="new-password-input"
              />
              <TouchableOpacity onPress={() => setShow(!show)} style={{ padding: 4 }}>
                <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Confirmar contraseña</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color="#fff" style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                placeholder="Repite la contraseña"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={password2}
                onChangeText={setPassword2}
                secureTextEntry={!show}
                autoCapitalize="none"
                editable={!loading}
                testID="confirm-password-input"
              />
            </View>

            {error && Platform.OS !== 'web' ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              testID="submit-change-password-btn"
            >
              {loading ? (
                <ActivityIndicator color={GOLD} />
              ) : (
                <Text style={styles.submitBtnText}>Guardar contraseña</Text>
              )}
            </TouchableOpacity>

            {forced && (
              <TouchableOpacity style={styles.logoutLink} onPress={handleLogout}>
                <Text style={styles.logoutLinkText}>Cerrar sesión</Text>
              </TouchableOpacity>
            )}
          </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GOLD },
  safe: { flex: 1, backgroundColor: GOLD },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: GREEN,
    lineHeight: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  submitBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnText: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#fecaca',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 8,
    borderRadius: 8,
  },
  logoutLink: {
    alignSelf: 'center',
    paddingVertical: 14,
    marginTop: 12,
  },
  logoutLinkText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
