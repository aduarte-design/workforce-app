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
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
} from '@/src/utils/api';

export default function SolicitudesScreen() {
  const { isAdmin } = useAuth();
  
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequest, setNewRequest] = useState({
    type: 'vacation',
    start_date: new Date(),
    end_date: new Date(),
    reason: '',
    proof_document: '',
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await getLeaveRequests();
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }, []);

  const handleCreateRequest = async () => {
    if (!newRequest.reason.trim()) {
      Alert.alert('Error', 'Por favor ingresa una razón para la solicitud');
      return;
    }

    setIsSubmitting(true);
    try {
      await createLeaveRequest({
        type: newRequest.type,
        start_date: newRequest.start_date.toISOString().split('T')[0],
        end_date: newRequest.end_date.toISOString().split('T')[0],
        reason: newRequest.reason,
        proof_document: newRequest.proof_document || undefined,
      });

      Alert.alert('Éxito', 'Solicitud creada correctamente');
      setShowNewRequestModal(false);
      resetNewRequest();
      loadRequests();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo crear la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetNewRequest = () => {
    setNewRequest({
      type: 'vacation',
      start_date: new Date(),
      end_date: new Date(),
      reason: '',
      proof_document: '',
    });
  };

  const handlePickDocument = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita permiso para acceder a las fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setNewRequest({
        ...newRequest,
        proof_document: `data:image/jpeg;base64,${result.assets[0].base64}`,
      });
    }
  };

  const handleApproveReject = async (requestId: string, status: 'approved' | 'rejected') => {
    const actionText = status === 'approved' ? 'aprobar' : 'rechazar';
    Alert.alert(
      'Confirmar',
      `¿Estás seguro de ${actionText} esta solicitud?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await approveLeaveRequest(requestId, status);
              Alert.alert('Éxito', `Solicitud ${status === 'approved' ? 'aprobada' : 'rechazada'}`);
              loadRequests();
            } catch (error) {
              Alert.alert('Error', 'No se pudo actualizar la solicitud');
            }
          },
        },
      ]
    );
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'Vacaciones';
      case 'medical':
        return 'Cita Médica';
      case 'normal':
        return 'Permiso';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'approved':
        return '#10b981';
      case 'rejected':
        return '#ef4444';
      default:
        return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      default:
        return status;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Solicitudes</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowNewRequestModal(true)}
        >
          <Ionicons name="add" size={24} color="#122c2a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hay solicitudes</Text>
          </View>
        ) : (
          requests.map((request) => (
            <View key={request._id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.requestType}>
                  <Text style={styles.requestTypeText}>{getTypeLabel(request.type)}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(request.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{getStatusLabel(request.status)}</Text>
                </View>
              </View>

              {isAdmin && request.user_name && (
                <Text style={styles.userName}>{request.user_name}</Text>
              )}

              <View style={styles.requestDates}>
                <Ionicons name="calendar-outline" size={16} color="#666" />
                <Text style={styles.datesText}>
                  {request.start_date} - {request.end_date}
                </Text>
              </View>

              <Text style={styles.requestReason}>{request.reason}</Text>

              {request.proof_document && (
                <View style={styles.documentIndicator}>
                  <Ionicons name="document-attach" size={16} color="#122c2a" />
                  <Text style={styles.documentText}>Documento adjunto</Text>
                </View>
              )}

              {isAdmin && request.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApproveReject(request._id, 'approved')}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Aprobar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleApproveReject(request._id, 'rejected')}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Rechazar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* New Request Modal */}
      <Modal
        visible={showNewRequestModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewRequestModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Solicitud</Text>
              <TouchableOpacity onPress={() => setShowNewRequestModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>Tipo de Permiso</Text>
              <View style={styles.typeButtons}>
                {['vacation', 'medical', 'normal'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      newRequest.type === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setNewRequest({ ...newRequest, type })}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        newRequest.type === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {getTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Fecha Inicio</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <Text style={styles.dateText}>
                  {newRequest.start_date.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              {showStartDatePicker && (
                <DateTimePicker
                  value={newRequest.start_date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowStartDatePicker(Platform.OS === 'ios');
                    if (date) {
                      setNewRequest({ ...newRequest, start_date: date });
                    }
                  }}
                />
              )}

              <Text style={styles.label}>Fecha Fin</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <Text style={styles.dateText}>
                  {newRequest.end_date.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              {showEndDatePicker && (
                <DateTimePicker
                  value={newRequest.end_date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={newRequest.start_date}
                  onChange={(event, date) => {
                    setShowEndDatePicker(Platform.OS === 'ios');
                    if (date) {
                      setNewRequest({ ...newRequest, end_date: date });
                    }
                  }}
                />
              )}

              <Text style={styles.label}>Razón</Text>
              <TextInput
                style={styles.textArea}
                value={newRequest.reason}
                onChangeText={(text) => setNewRequest({ ...newRequest, reason: text })}
                placeholder="Describe la razón de tu solicitud..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handlePickDocument}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#122c2a" />
                <Text style={styles.uploadButtonText}>
                  {newRequest.proof_document ? 'Documento adjuntado' : 'Adjuntar documento'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleCreateRequest}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Creando...' : 'Crear Solicitud'}
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
    backgroundColor: '#f5f5f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f5f5f7',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -1,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestType: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  requestTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#122c2a',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#122c2a',
    marginBottom: 8,
  },
  requestDates: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  datesText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  requestReason: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  documentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  documentText: {
    fontSize: 12,
    color: '#122c2a',
    marginLeft: 6,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    maxHeight: '90%',
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
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#122c2a',
    borderColor: '#122c2a',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#122c2a',
    fontWeight: '500',
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
