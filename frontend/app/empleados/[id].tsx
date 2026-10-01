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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { getUser, getUserKudos, setEmployeeOfMonth, deleteUser, updateUser, downloadUserPdf } from '@/src/utils/api';

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
      `Antes de eliminar a ${employee.name} se descargará automáticamente un PDF con todo su expediente (datos personales, permisos y likes). Esta acción es irreversible.`,
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
        <View style={{ width: 44 }} />
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

      {/* Hire date edit modal */}
      <Modal
        visible={showHireDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHireDateModal(false)}
      >
        <View style={styles.modalOverlay}>
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
        </View>
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
});
