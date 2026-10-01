import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { confirmPasswordReset } from '@/src/utils/api';

const GREEN = '#122c2a';
const GOLD = '#b68a2e';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [tokenInput, setTokenInput] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.token) setTokenInput(String(params.token));
  }, [params.token]);

  const alertMsg = (msg: string) => {
    if (Platform.OS === 'web') window.alert(msg);
    else setError(msg);
  };

  const handleSubmit = async () => {
    setError('');
    const tok = tokenInput.trim();
    if (!tok) {
      alertMsg('Falta el token del correo');
      return;
    }
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
      await confirmPasswordReset(tok, password);
      setSuccess(true);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'No se pudo restablecer la contraseña';
      alertMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/login' as any)}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.iconCircle}>
              <Ionicons name="key" size={32} color={GREEN} />
            </View>

            <Text style={styles.title}>Nueva contraseña</Text>

            {success ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                <Text style={styles.successTitle}>¡Contraseña actualizada!</Text>
                <Text style={styles.successText}>
                  Ya puedes iniciar sesión con tu nueva contraseña.
                </Text>
                <TouchableOpacity
                  style={[styles.submitBtn, { marginTop: 24 }]}
                  onPress={() => router.replace('/login' as any)}
                >
                  <Text style={styles.submitBtnText}>Ir al login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Escribe tu nueva contraseña. Debe tener al menos 6 caracteres.
                </Text>

                {!params.token && (
                  <>
                    <Text style={styles.inputLabel}>Token del correo</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="link-outline" size={18} color="#fff" style={{ marginRight: 10 }} />
                      <TextInput
                        style={styles.input}
                        placeholder="Pega el token aquí"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        value={tokenInput}
                        onChangeText={setTokenInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                      />
                    </View>
                  </>
                )}

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
                >
                  {loading ? (
                    <ActivityIndicator color={GOLD} />
                  ) : (
                    <Text style={styles.submitBtnText}>Restablecer</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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
    marginBottom: 24,
    lineHeight: 20,
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
  successBox: {
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginTop: 14,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
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
});
