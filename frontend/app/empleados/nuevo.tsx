import React, { useState } from 'react';
import { showAlert } from '@/src/utils/alert';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { registerUser } from '@/src/utils/api';

export default function NewEmployeeScreen() {
  const router = useRouter();
  
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    position: '',
    phone: '',
    birthdate: new Date(1990, 0, 1),
    hire_date: new Date(),
    role: 'employee' as 'employee' | 'admin',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showHireDatePicker, setShowHireDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    // Validation
    if (!form.email.trim() || !form.email.includes('@')) {
      showAlert('Error', 'Ingresa un correo válido');
      return;
    }
    if (!form.password || form.password.length < 6) {
      showAlert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!form.name.trim()) {
      showAlert('Error', 'Ingresa el nombre del empleado');
      return;
    }
    if (!form.position.trim()) {
      showAlert('Error', 'Ingresa el cargo del empleado');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerUser({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        name: form.name.trim(),
        position: form.position.trim(),
        phone: form.phone.trim() || undefined,
        birthdate: form.birthdate.toISOString().split('T')[0],
        hire_date: form.hire_date.toISOString().split('T')[0],
        role: form.role,
      });

      // Show alert (native) and navigate back (works on both web and native)
      if (Platform.OS === 'web') {
        // Use a simple confirm on web since Alert doesn't render buttons
        window.alert('Empleado creado correctamente');
        router.back();
      } else {
        showAlert('Éxito', 'Empleado creado correctamente', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'No se pudo crear el empleado';
      if (Platform.OS === 'web') {
        window.alert('Error: ' + msg);
      } else {
        showAlert('Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#122c2a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuevo Empleado</Text>
        <View style={{ width: 44 }} />
      </View>

        <KeyboardAwareScrollView
            bottomOffset={32}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Role Selector */}
          <Text style={styles.label}>Tipo de Cuenta</Text>
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[styles.roleOption, form.role === 'employee' && styles.roleOptionActive]}
              onPress={() => setForm({ ...form, role: 'employee' })}
            >
              <Ionicons
                name="person"
                size={20}
                color={form.role === 'employee' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.roleOptionText,
                  form.role === 'employee' && styles.roleOptionTextActive,
                ]}
              >
                Empleado
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleOption, form.role === 'admin' && styles.roleOptionActive]}
              onPress={() => setForm({ ...form, role: 'admin' })}
            >
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={form.role === 'admin' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.roleOptionText,
                  form.role === 'admin' && styles.roleOptionTextActive,
                ]}
              >
                Administrador
              </Text>
            </TouchableOpacity>
          </View>
          {form.role === 'admin' && (
            <Text style={styles.hint}>
              ⚠️ Máximo 3 administradores permitidos
            </Text>
          )}

          {/* Name */}
          <Text style={styles.label}>Nombre completo *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
              placeholder="Ej: Juan Pérez"
            />
          </View>

          {/* Position */}
          <Text style={styles.label}>Cargo *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="briefcase-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.position}
              onChangeText={(text) => setForm({ ...form, position: text })}
              placeholder="Ej: Desarrollador Senior"
            />
          </View>

          {/* Email */}
          <Text style={styles.label}>Correo corporativo *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text })}
              placeholder="empleado@conactivos.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Contraseña temporal *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={(text) => setForm({ ...form, password: text })}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Phone */}
          <Text style={styles.label}>Teléfono</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(text) => setForm({ ...form, phone: text })}
              placeholder="555-0000"
              keyboardType="phone-pad"
            />
          </View>

          {/* Birthdate */}
          <Text style={styles.label}>Fecha de Cumpleaños</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="gift-outline" size={20} color="#666" />
            <Text style={styles.dateText}>
              {form.birthdate.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={form.birthdate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) {
                  setForm({ ...form, birthdate: date });
                }
              }}
            />
          )}

          {/* Hire date */}
          <Text style={styles.label}>Fecha de Ingreso</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowHireDatePicker(true)}
            testID="hire-date-picker-btn"
          >
            <Ionicons name="briefcase-outline" size={20} color="#666" />
            <Text style={styles.dateText}>
              {form.hire_date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>

          {showHireDatePicker && (
            <DateTimePicker
              value={form.hire_date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(event, date) => {
                setShowHireDatePicker(Platform.OS === 'ios');
                if (date) {
                  setForm({ ...form, hire_date: date });
                }
              }}
            />
          )}

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleCreate}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Crear Empleado</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.noteCard}>
            <Ionicons name="information-circle" size={20} color="#666" />
            <Text style={styles.noteText}>
              El empleado podrá iniciar sesión con el correo y contraseña asignados.
            </Text>
          </View>
        </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f7',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#122c2a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 16,
  },
  hint: {
    fontSize: 12,
    color: '#b68a2e',
    marginTop: 6,
    fontWeight: '500',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  roleOptionActive: {
    backgroundColor: '#122c2a',
    borderColor: '#122c2a',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  roleOptionTextActive: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#122c2a',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  dateText: {
    fontSize: 15,
    color: '#122c2a',
    textTransform: 'capitalize',
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#122c2a',
    padding: 16,
    borderRadius: 100,
    marginTop: 32,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});
