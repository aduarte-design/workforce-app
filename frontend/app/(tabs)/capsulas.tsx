import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getCapsules,
  createCapsule,
  updateCapsule,
  deleteCapsule,
  getUsers,
} from '@/src/utils/api';

export default function CapsulasScreen() {
  const { user } = useAuth();
  
  const [capsules, setCapsules] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCapsuleModal, setShowCapsuleModal] = useState(false);
  const [editingCapsule, setEditingCapsule] = useState<any>(null);
  const [capsuleForm, setCapsuleForm] = useState({
    date: new Date(),
    topic: '',
    responsible_employee_id: '',
    description: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEmployeeSelect, setShowEmployeeSelect] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [capsulesData, employeesData] = await Promise.all([
        getCapsules(),
        getUsers(),
      ]);
      setCapsules(capsulesData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleOpenModal = (capsule?: any) => {
    if (capsule) {
      setEditingCapsule(capsule);
      setCapsuleForm({
        date: new Date(capsule.date),
        topic: capsule.topic,
        responsible_employee_id: capsule.responsible_employee_id,
        description: capsule.description || '',
      });
    } else {
      setEditingCapsule(null);
      setCapsuleForm({
        date: new Date(),
        topic: '',
        responsible_employee_id: user?._id || '',
        description: '',
      });
    }
    setShowCapsuleModal(true);
  };

  const handleCloseModal = () => {
    setShowCapsuleModal(false);
    setEditingCapsule(null);
    setCapsuleForm({
      date: new Date(),
      topic: '',
      responsible_employee_id: '',
      description: '',
    });
  };

  const handleSaveCapsule = async () => {
    if (!capsuleForm.topic.trim()) {
      Alert.alert('Error', 'Por favor ingresa un tema para la cápsula');
      return;
    }

    if (!capsuleForm.responsible_employee_id) {
      Alert.alert('Error', 'Por favor selecciona un empleado responsable');
      return;
    }

    setIsSubmitting(true);
    try {
      const capsuleData = {
        date: capsuleForm.date.toISOString().split('T')[0],
        topic: capsuleForm.topic,
        responsible_employee_id: capsuleForm.responsible_employee_id,
        description: capsuleForm.description,
      };

      if (editingCapsule) {
        await updateCapsule(editingCapsule._id, capsuleData);
        Alert.alert('Éxito', 'Cápsula actualizada correctamente');
      } else {
        await createCapsule(capsuleData);
        Alert.alert('Éxito', 'Cápsula creada correctamente');
      }

      handleCloseModal();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar la cápsula');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCapsule = (capsuleId: string) => {
    Alert.alert('Eliminar Cápsula', '¿Estás seguro de eliminar esta cápsula?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCapsule(capsuleId);
            Alert.alert('Éxito', 'Cápsula eliminada');
            loadData();
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar la cápsula');
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isUpcoming = (dateStr: string) => {
    const capsuleDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return capsuleDate >= today;
  };

  const upcomingCapsules = capsules.filter((c) => isUpcoming(c.date));
  const pastCapsules = capsules.filter((c) => !isUpcoming(c.date));

  const selectedEmployee = employees.find(
    (e) => e._id === capsuleForm.responsible_employee_id
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cápsulas</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleOpenModal()}
        >
          <Ionicons name="add" size={22} color="#122c2a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {upcomingCapsules.length === 0 && pastCapsules.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bulb-outline" size={64} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>No hay cápsulas programadas</Text>
          </View>
        ) : (
          <>
            {upcomingCapsules.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Próximas Cápsulas</Text>
                {upcomingCapsules.map((capsule) => (
                  <View key={capsule._id} style={styles.capsuleCard}>
                    <View style={styles.capsuleHeader}>
                      <View style={styles.capsuleIcon}>
                        <Ionicons name="bulb" size={24} color="#b68a2e" />
                      </View>
                      <View style={styles.capsuleInfo}>
                        <Text style={styles.capsuleTopic}>{capsule.topic}</Text>
                        <Text style={styles.capsuleDate}>{formatDate(capsule.date)}</Text>
                      </View>
                    </View>

                    <View style={styles.responsibleContainer}>
                      <Ionicons name="person" size={14} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.responsibleText}>
                        Responsable: {capsule.responsible_employee_name}
                      </Text>
                    </View>

                    {capsule.description && (
                      <Text style={styles.capsuleDescription}>{capsule.description}</Text>
                    )}

                    <View style={styles.capsuleActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleOpenModal(capsule)}
                      >
                        <Ionicons name="create-outline" size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDeleteCapsule(capsule._id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#f87171" />
                        <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>
                          Eliminar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {pastCapsules.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Cápsulas Pasadas</Text>
                {pastCapsules.map((capsule) => (
                  <View key={capsule._id} style={[styles.capsuleCard, styles.pastCapsuleCard]}>
                    <View style={styles.capsuleHeader}>
                      <View style={[styles.capsuleIcon, styles.pastCapsuleIcon]}>
                        <Ionicons name="bulb-outline" size={24} color="#999" />
                      </View>
                      <View style={styles.capsuleInfo}>
                        <Text style={styles.capsuleTopic}>{capsule.topic}</Text>
                        <Text style={styles.capsuleDate}>{formatDate(capsule.date)}</Text>
                      </View>
                    </View>

                    <View style={styles.responsibleContainer}>
                      <Ionicons name="person" size={14} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.responsibleText}>
                        Responsable: {capsule.responsible_employee_name}
                      </Text>
                    </View>

                    {capsule.description && (
                      <Text style={styles.capsuleDescription}>{capsule.description}</Text>
                    )}

                    <TouchableOpacity
                      style={styles.deleteOnlyButton}
                      onPress={() => handleDeleteCapsule(capsule._id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#f87171" />
                      <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>
                        Eliminar
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Capsule Modal */}
      <Modal
        visible={showCapsuleModal}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCapsule ? 'Editar Cápsula' : 'Nueva Cápsula'}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>Tema de la Cápsula</Text>
              <TextInput
                style={styles.input}
                value={capsuleForm.topic}
                onChangeText={(text) => setCapsuleForm({ ...capsuleForm, topic: text })}
                placeholder="Ej: Atención al cliente"
              />

              <Text style={styles.label}>Fecha</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <Text style={styles.dateText}>
                  {capsuleForm.date.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={capsuleForm.date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) {
                      setCapsuleForm({ ...capsuleForm, date });
                    }
                  }}
                />
              )}

              <Text style={styles.label}>Empleado Responsable</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowEmployeeSelect(!showEmployeeSelect)}
              >
                <Ionicons name="person-outline" size={20} color="#666" />
                <Text style={styles.selectText}>
                  {selectedEmployee ? selectedEmployee.name : 'Seleccionar empleado'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>

              {showEmployeeSelect && (
                <View style={styles.employeeList}>
                  {employees.map((employee) => (
                    <TouchableOpacity
                      key={employee._id}
                      style={[
                        styles.employeeItem,
                        capsuleForm.responsible_employee_id === employee._id &&
                          styles.employeeItemSelected,
                      ]}
                      onPress={() => {
                        setCapsuleForm({
                          ...capsuleForm,
                          responsible_employee_id: employee._id,
                        });
                        setShowEmployeeSelect(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.employeeItemText,
                          capsuleForm.responsible_employee_id === employee._id &&
                            styles.employeeItemTextSelected,
                        ]}
                      >
                        {employee.name}
                      </Text>
                      <Text style={styles.employeeItemPosition}>{employee.position}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Descripción (Opcional)</Text>
              <TextInput
                style={styles.textArea}
                value={capsuleForm.description}
                onChangeText={(text) =>
                  setCapsuleForm({ ...capsuleForm, description: text })
                }
                placeholder="Describe el tema a desarrollar..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSaveCapsule}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting
                    ? 'Guardando...'
                    : editingCapsule
                    ? 'Actualizar'
                    : 'Crear Cápsula'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#122c2a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#122c2a',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#b68a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 10,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  capsuleCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  pastCapsuleCard: {
    opacity: 0.5,
  },
  capsuleHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  capsuleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(182, 138, 46, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pastCapsuleIcon: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  capsuleInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  capsuleTopic: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  capsuleDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'capitalize',
  },
  responsibleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 4,
  },
  responsibleText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 6,
  },
  capsuleDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
    marginBottom: 10,
  },
  capsuleActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  deleteOnlyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    gap: 4,
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#122c2a',
  },
  modalScroll: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#122c2a',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#333',
    textTransform: 'capitalize',
    flex: 1,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    gap: 8,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  employeeList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
    maxHeight: 200,
  },
  employeeItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  employeeItemSelected: {
    backgroundColor: '#f0fdf4',
  },
  employeeItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  employeeItemTextSelected: {
    color: '#122c2a',
    fontWeight: '600',
  },
  employeeItemPosition: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#122c2a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
