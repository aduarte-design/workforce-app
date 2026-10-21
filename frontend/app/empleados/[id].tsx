import React, { useState, useEffect } from 'react';
import { showAlert } from '@/src/utils/alert';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView as KCAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { getUser, getUserKudos, setEmployeeOfMonth, deleteUser, updateUser, downloadUserPdf } from '@/src/utils/api';
import MoodCard from '@/src/components/MoodCard';

const CATEGORY_INFO: any = {
  teamwork: { label: 'Trabajo en Equipo', color: '#3b82f6' },
  innovation: { label: 'Innovación', color: '#8b5cf6' },
  leadership: { label: 'Liderazgo', color: '#b68a2e' },
  excellence: { label: 'Excelencia', color: '#f59e0b' },
  helpful: { label: 'Colaborador', color: '#10b981' },
};

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  
  const [employee, setEmployee] = useState<any>(null);
  const [kudos, setKudos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showHireDateModal, setShowHireDateModal] = useState(false);
  const [hireDateInput, setHireDateInput] = useState('');
  const [savingHireDate, setSavingHireDate] = useState(false);

  // Full admin-edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    position: '',
    phone: '',
    birthdate: '',
    hire_date: '',
    role: 'employee' as 'employee' | 'admin',
    leadership_statement: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const isSelf = user?._id === id;

  useEffect(() => {
    if (id) {
      loadEmployee();
    }
  }, [id]);

  const loadEmployee = async () => {
    try {
      setIsLoading(true);
      const [employeeData, kudosData] = await Promise.all([
        getUser(id as string),
        getUserKudos(id as string),
      ]);
      setEmployee(employeeData);
      setKudos(kudosData);
    } catch (error) {
      console.error('Error loading employee:', error);
      showAlert('Error', 'No se pudo cargar el empleado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetEmployeeOfMonth = () => {
    showAlert(
      'Empleado del Mes',
      `¿Establecer a ${employee.name} como Empleado del Mes?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await setEmployeeOfMonth(id as string);
              showAlert('Éxito', 'Empleado del Mes actualizado');
              loadEmployee();
            } catch (error) {
              showAlert('Error', 'No se pudo actualizar');
            }
          },
        },
      ]
    );
  };

  const openHireDateModal = () => {
    setHireDateInput(employee?.hire_date || '');
    setShowHireDateModal(true);
  };

  const openEditModal = () => {
    if (!employee) return;
    setEditForm({
      name: employee.name || '',
      email: employee.email || '',
      position: employee.position || '',
      phone: employee.phone || '',
      birthdate: employee.birthdate || '',
      hire_date: employee.hire_date || '',
      role: employee.role || 'employee',
      leadership_statement: employee.leadership_statement || '',
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    // Minimal validation
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.position.trim()) {
      showAlert('Faltan datos', 'Nombre, correo y cargo son obligatorios.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(editForm.email.trim())) {
      showAlert('Correo inválido', 'Ingresa un correo con formato válido.');
      return;
    }
    for (const key of ['birthdate', 'hire_date'] as const) {
      const v = (editForm[key] || '').trim();
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        showAlert('Formato inválido', `${key === 'birthdate' ? 'Fecha de nacimiento' : 'Fecha de ingreso'}: usa AAAA-MM-DD`);
        return;
      }
    }
    setSavingEdit(true);
    try {
      const payload: any = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        position: editForm.position.trim(),
        phone: editForm.phone.trim(),
        birthdate: editForm.birthdate.trim() || null,
        hire_date: editForm.hire_date.trim() || null,
        leadership_statement: editForm.leadership_statement.trim(),
      };
      // Only send role change if different, and only if admin (frontend-side gate)
      if (isAdmin && editForm.role !== employee.role) {
        payload.role = editForm.role;
      }
      await updateUser(id as string, payload);
      setShowEditModal(false);
      loadEmployee();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'No se pudo guardar');
    } finally {
      setSavingEdit(false);
    }
  };

  const saveHireDate = async () => {
    const value = hireDateInput.trim();
    // Validate YYYY-MM-DD
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      showAlert('Formato inválido', 'Usa el formato AAAA-MM-DD (ej: 2024-03-15)');
      return;
    }
    setSavingHireDate(true);
    try {
      await updateUser(id as string, { hire_date: value || null });
      setShowHireDateModal(false);
      loadEmployee();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'No se pudo guardar la fecha');
    } finally {
      setSavingHireDate(false);
    }
  };

  const handleDelete = () => {
    if (!employee) return;
    const roleWord = employee.role === 'admin' ? 'administrador' : 'empleado';
    const safeName = (employee.name || 'empleado').replace(/\s+/g, '_');
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `Expediente_${safeName}_${today}.pdf`;

    showAlert(
      `Eliminar ${roleWord}`,
      `Antes de eliminar a ${employee.name} se descargará automáticamente un PDF con todo su expediente (datos personales, novedades y likes). Esta acción es irreversible.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descargar PDF y eliminar',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              // 1. Download the PDF first (so admin always has the record)
              try {
                await downloadUserPdf(id as string, filename);
              } catch (pdfErr: any) {
                setIsDeleting(false);
                showAlert('Error', 'No se pudo generar el PDF. Eliminación cancelada.');
                return;
              }

              // 2. Then delete the user
              await deleteUser(id as string);
              showAlert('Eliminado', `${employee.name} ha sido eliminado. El PDF fue descargado.`);
              router.back();
            } catch (error: any) {
              const detail = error?.response?.data?.detail || error?.message || 'No se pudo eliminar el usuario';
              showAlert('Error', detail);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading || !employee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#122c2a" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#122c2a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Empleado</Text>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.headerEditBtn}
            onPress={openEditModal}
            testID="open-edit-modal-btn"
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {employee.profile_photo ? (
              <Image source={{ uri: employee.profile_photo }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={60} color="#122c2a" />
            )}
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{employee.name}</Text>
            {employee.is_employee_of_month && (
              <Ionicons name="star" size={20} color="#b68a2e" />
            )}
          </View>
          <Text style={styles.position}>{employee.position}</Text>
          
          {employee.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#122c2a" />
              <Text style={styles.adminText}>Administrador</Text>
            </View>
          )}

          {isAdmin && !employee.is_employee_of_month && (
            <TouchableOpacity
              style={styles.employeeOfMonthBtn}
              onPress={handleSetEmployeeOfMonth}
            >
              <Ionicons name="star" size={16} color="#fff" />
              <Text style={styles.employeeOfMonthBtnText}>Marcar como Empleado del Mes</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Leadership Statement — admin-set, visible to the employee */}
        {!!employee.leadership_statement && (
          <View style={styles.leadershipCard}>
            <View style={styles.leadershipHeader}>
              <View style={styles.leadershipIconWrap}>
                <Ionicons name="trophy" size={16} color="#b68a2e" />
              </View>
              <Text style={styles.leadershipTitle}>Tu lideras con...</Text>
            </View>
            <Text style={styles.leadershipText}>{employee.leadership_statement}</Text>
          </View>
        )}

        {/* Mood — editable only by the owner. For admins viewing other profiles it's read-only. */}
        {(isSelf || employee.mood) && (
          <MoodCard
            value={employee.mood}
            editable={isSelf}
            onSave={async (newMood) => {
              try {
                await updateUser(id as string, { mood: newMood });
                setEmployee({ ...employee, mood: newMood });
              } catch (e: any) {
                showAlert('Error', e?.response?.data?.detail || 'No se pudo guardar');
                throw e;
              }
            }}
          />
        )}

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Correo</Text>
              <Text style={styles.infoValue}>{employee.email}</Text>
            </View>
          </View>

          {employee.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{employee.phone}</Text>
              </View>
            </View>
          )}

          {employee.birthdate && (
            <View style={styles.infoRow}>
              <Ionicons name="gift-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Cumpleaños</Text>
                <Text style={styles.infoValue}>{employee.birthdate}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="briefcase-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Fecha de Ingreso</Text>
              <Text style={[styles.infoValue, !employee.hire_date && styles.infoValueMuted]}>
                {employee.hire_date || 'No establecida'}
              </Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                style={styles.editIconBtn}
                onPress={openHireDateModal}
                testID="edit-hire-date-btn"
              >
                <Ionicons name="pencil" size={16} color="#b68a2e" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Kudos Received */}
        <View style={styles.card}>
          <View style={styles.kudosCardHeader}>
            <Ionicons name="heart" size={20} color="#ef4444" />
            <Text style={styles.cardTitle}>Likes Recibidos ({kudos.length})</Text>
          </View>

          {kudos.length === 0 ? (
            <Text style={styles.emptyText}>Aún no ha recibido likes</Text>
          ) : (
            kudos.slice(0, 5).map((kudo) => {
              const cat = CATEGORY_INFO[kudo.category] || CATEGORY_INFO.teamwork;
              return (
                <View key={kudo._id} style={styles.kudoItem}>
                  <View style={[styles.kudoBadge, { backgroundColor: cat.color }]}>
                    <Text style={styles.kudoBadgeText}>{cat.label}</Text>
                  </View>
                  <Text style={styles.kudoFrom}>De: {kudo.from_user_name}</Text>
                  <Text style={styles.kudoMessage}>&quot;{kudo.message}&quot;</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Danger Zone - Delete User (admin only, not self) */}
        {isAdmin && !isSelf && (
          <TouchableOpacity
            style={[styles.deleteBtn, isDeleting && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={isDeleting}
            testID="delete-user-btn"
            activeOpacity={0.85}
          >
            {isDeleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.deleteBtnText}>
                  Eliminar {employee.role === 'admin' ? 'administrador' : 'empleado'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Full admin edit modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KCAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCardLarge}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>Editar perfil</Text>
            <KeyboardAwareScrollView
              bottomOffset={24}
              style={{ maxHeight: 460 }}
              contentContainerStyle={{ paddingBottom: 10 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Nombre completo</Text>
              <TextInput
                style={styles.fieldInput}
                value={editForm.name}
                onChangeText={(t) => setEditForm({ ...editForm, name: t })}
                placeholder="Nombre y apellido"
                placeholderTextColor="#9ca3af"
                testID="edit-name-input"
              />

              <Text style={styles.fieldLabel}>Correo</Text>
              <TextInput
                style={styles.fieldInput}
                value={editForm.email}
                onChangeText={(t) => setEditForm({ ...editForm, email: t })}
                placeholder="correo@conactivos.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                testID="edit-email-input"
              />

              <Text style={styles.fieldLabel}>Cargo</Text>
              <TextInput
                style={styles.fieldInput}
                value={editForm.position}
                onChangeText={(t) => setEditForm({ ...editForm, position: t })}
                placeholder="Cargo o puesto"
                placeholderTextColor="#9ca3af"
                testID="edit-position-input"
              />

              <Text style={styles.fieldLabel}>Teléfono</Text>
              <TextInput
                style={styles.fieldInput}
                value={editForm.phone}
                onChangeText={(t) => setEditForm({ ...editForm, phone: t })}
                placeholder="300 123 4567"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>Fecha de nacimiento (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.fieldInput}
                value={editForm.birthdate}
                onChangeText={(t) => setEditForm({ ...editForm, birthdate: t })}
                placeholder="1990-05-20"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Fecha de ingreso (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.fieldInput}
                value={editForm.hire_date}
                onChangeText={(t) => setEditForm({ ...editForm, hire_date: t })}
                placeholder="2024-03-15"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Rol</Text>
              <View style={styles.roleRow}>
                {(['employee', 'admin'] as const).map((r) => {
                  const active = editForm.role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.rolePill, active && styles.rolePillActive]}
                      onPress={() => setEditForm({ ...editForm, role: r })}
                      disabled={isSelf}
                    >
                      <Text style={[styles.rolePillText, active && styles.rolePillTextActive]}>
                        {r === 'admin' ? 'Administrador' : 'Empleado'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {isSelf && (
                <Text style={styles.roleHint}>No puedes cambiar tu propio rol.</Text>
              )}

              <Text style={styles.fieldLabel}>Tu lideras con...</Text>
              <Text style={styles.fieldHint}>
                Frase corta que resume el estilo de liderazgo o fortaleza del colaborador.
                Solo administradores pueden editarla.
              </Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMultiline]}
                value={editForm.leadership_statement}
                onChangeText={(t) => setEditForm({ ...editForm, leadership_statement: t })}
                placeholder="Ej: Empatía y escucha activa"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                maxLength={160}
                testID="edit-leadership-input"
              />
            </KeyboardAwareScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setShowEditModal(false)}
                disabled={savingEdit}
              >
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, savingEdit && { opacity: 0.6 }]}
                onPress={saveEdit}
                disabled={savingEdit}
                testID="save-edit-btn"
              >
                {savingEdit ? (
                  <ActivityIndicator color="#b68a2e" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KCAvoidingView>
      </Modal>

      {/* Hire date edit modal */}
      <Modal
        visible={showHireDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHireDateModal(false)}
      >
        <KCAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Fecha de ingreso</Text>
            <Text style={styles.modalHint}>Formato: AAAA-MM-DD (ej: 2024-03-15)</Text>
            <TextInput
              style={styles.modalInput}
              value={hireDateInput}
              onChangeText={setHireDateInput}
              placeholder="2024-03-15"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
              testID="hire-date-input"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setShowHireDateModal(false)}
                disabled={savingHireDate}
              >
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, savingHireDate && { opacity: 0.6 }]}
                onPress={saveHireDate}
                disabled={savingHireDate}
                testID="save-hire-date-btn"
              >
                {savingHireDate ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KCAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#b68a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#122c2a',
  },
  position: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    marginTop: 4,
  },
  adminText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#122c2a',
  },
  employeeOfMonthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b68a2e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    marginTop: 16,
    gap: 6,
  },
  employeeOfMonthBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#122c2a',
    marginBottom: 12,
  },
  kudosCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#122c2a',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
  kudoItem: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  kudoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 6,
  },
  kudoBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  kudoFrom: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  kudoMessage: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  deleteBtnDisabled: {
    opacity: 0.6,
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  infoValueMuted: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#122c2a',
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#122c2a',
    backgroundColor: '#f9fafb',
    marginBottom: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: {
    backgroundColor: '#f3f4f6',
  },
  modalBtnGhostText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBtnPrimary: {
    backgroundColor: '#122c2a',
  },
  modalBtnPrimaryText: {
    color: '#b68a2e',
    fontSize: 14,
    fontWeight: '800',
  },
  headerEditBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#122c2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leadershipCard: {
    backgroundColor: '#122c2a',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  leadershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  leadershipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(182,138,46,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leadershipTitle: {
    color: '#b68a2e',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  leadershipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  modalCardLarge: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#122c2a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
    lineHeight: 15,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#122c2a',
    backgroundColor: '#f9fafb',
  },
  fieldInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  rolePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  rolePillActive: {
    backgroundColor: '#122c2a',
    borderColor: '#122c2a',
  },
  rolePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  rolePillTextActive: {
    color: '#b68a2e',
  },
  roleHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
