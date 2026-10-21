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
import { requestPasswordReset } from '@/src/utils/api';

const GREEN = '#122c2a';
const GOLD = '#b68a2e';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      if (Platform.OS === 'web') window.alert('Ingresa un correo válido');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      // Even on error, show success to avoid leaking account info
      setSent(true);
    } finally {
      setLoading(false);
    }
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
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={34} color={GREEN} />
            </View>

            <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>

            {!sent ? (
              <>
                <Text style={styles.subtitle}>
                  Ingresa tu correo corporativo. Te enviaremos una contraseña temporal para que
                  puedas ingresar y cambiarla de inmediato.
                </Text>

                <Text style={styles.inputLabel}>Correo corporativo</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color="#fff" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="tu@conactivos.com"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!loading}
                    testID="forgot-email-input"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                  testID="forgot-submit-btn"
                >
                  {loading ? (
                    <ActivityIndicator color={GOLD} />
                  ) : (
                    <Text style={styles.submitBtnText}>Enviar contraseña temporal</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                <Text style={styles.successTitle}>Revisa tu correo</Text>
                <Text style={styles.successText}>
                  Si <Text style={{ fontWeight: '800', color: '#fff' }}>{email}</Text> está
                  registrado, recibirás una contraseña temporal en tu bandeja. Entra con ella
                  y la app te pedirá crear una nueva.
                </Text>
                <TouchableOpacity
                  style={[styles.submitBtn, { marginTop: 20 }]}
                  onPress={() => router.replace('/login' as any)}
                >
                  <Text style={styles.submitBtnText}>Volver al login</Text>
                </TouchableOpacity>
              </View>
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
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
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
    letterSpacing: 0.2,
  },
  successBox: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginTop: 14,
    marginBottom: 10,
  },
  successText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
