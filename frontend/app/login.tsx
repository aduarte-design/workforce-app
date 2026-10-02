import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';

const GREEN = '#122c2a';
const GOLD = '#b68a2e';

type Feature = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bg: string;
  label1: string;
  label2: string;
};

const FEATURES: Feature[] = [
  { icon: 'document-text', iconColor: GOLD, bg: '#fef3c7', label1: 'Solicita', label2: 'permisos' },
  { icon: 'heart', iconColor: '#dc2626', bg: '#fce7f3', label1: 'Reconoce', label2: 'compañeras' },
  { icon: 'notifications', iconColor: GREEN, bg: '#dcfce7', label1: 'Mantente', label2: 'enterada' },
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const showAlert = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      setError(message);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      showAlert('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    try {
      const u = await login(email, password);
      if (u?.must_change_password) {
        router.replace('/change-password' as any);
      } else {
        router.replace('/(tabs)' as any);
      }
    } catch (err: any) {
      showAlert(err.message || 'Credenciales incorrectas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      showAlert(err.message || 'No se pudo autenticar con Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={GOLD} />
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
            {/* Logo (double size, green tone) */}
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/conactivos-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            {/* Welcome Text */}
            <Text style={styles.welcomeTitle}>Bienvenida</Text>

            {/* Feature Cards Row */}
            <View style={styles.featuresRow}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureCard}>
                  <View style={[styles.featureIconWrap, { backgroundColor: f.bg }]}>
                    <Ionicons name={f.icon} size={20} color={f.iconColor} />
                  </View>
                  <Text style={styles.featureLabel}>{f.label1}</Text>
                  <Text style={styles.featureLabel}>{f.label2}</Text>
                </View>
              ))}
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.inputLabel}>Correo corporativo</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color="#fff" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="tu@conactivos.com"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                  testID="email-input"
                />
              </View>

              <Text style={styles.inputLabel}>Contraseña</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color="#fff" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                  testID="password-input"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>

              {error && Platform.OS !== 'web' ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                testID="submit-login-btn"
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color={GOLD} />
                ) : (
                  <Text style={styles.loginButtonText}>Iniciar sesión</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => router.push('/forgot-password' as any)}
                testID="forgot-password-link"
              >
                <Text style={styles.forgotLinkText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o continúa con</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Button */}
              <TouchableOpacity
                style={[styles.googleButton, isGoogleLoading && styles.buttonDisabled]}
                onPress={handleGoogleLogin}
                disabled={isGoogleLoading}
                testID="google-login-btn"
                activeOpacity={0.85}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color={GREEN} />
                ) : (
                  <>
                    <View style={styles.googleIcon}>
                      <Text style={styles.googleG}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>Continuar con Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.helpBox}>
                <Ionicons name="information-circle-outline" size={16} color="rgba(18,44,42,0.6)" />
                <Text style={styles.helpText}>
                  Tu cuenta debe estar registrada por RRHH
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GOLD,
  },
  safe: {
    flex: 1,
    backgroundColor: GOLD,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  logo: {
    width: 160,
    height: 160,
    tintColor: '#fff',
  },
  welcomeTitle: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
    justifyContent: 'center',
  },
  featureCard: {
    width: 96,
    height: 96,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 10px rgba(0,0,0,0.08)' } as any,
    }),
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: GREEN,
    letterSpacing: -0.1,
    lineHeight: 13,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 14,
    paddingHorizontal: 4,
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#7f1d1d',
    marginTop: 8,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  loginButton: {
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    ...Platform.select({
      ios: {
        shadowColor: GREEN,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
      web: { boxShadow: '0 8px 24px rgba(18,44,42,0.35)' } as any,
    }),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  forgotLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  forgotLinkText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(18,44,42,0.2)',
  },
  dividerText: {
    fontSize: 12,
    color: 'rgba(18,44,42,0.65)',
    marginHorizontal: 12,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    height: 52,
    gap: 10,
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4285f4',
  },
  googleG: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4285f4',
  },
  googleButtonText: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '700',
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingHorizontal: 12,
  },
  helpText: {
    fontSize: 12,
    color: 'rgba(18,44,42,0.7)',
    fontWeight: '500',
  },
});
