import React, { useState, useEffect, useCallback } from 'react';
import { showAlert } from '@/src/utils/alert';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAvoidingView as KCAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import DateTimePicker from '@react-native-community/datetimepicker';
import ExportNovedadesModal from '@/src/components/ExportNovedadesModal';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  uploadProofFile,
  getFileUrl,
} from '@/src/utils/api';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Attachment = { uri: string; name: string; mimeType?: string | null; size?: number | null };

type PermResult = { granted: boolean; canAskAgain: boolean };

// Check → request (if allowed) → otherwise offer "Open Settings"
async function ensurePermission(
  get: () => Promise<PermResult>,
  request: () => Promise<PermResult>,
  label: string
) {
  let perm = await get();
  if (perm.granted) return true;
  if (perm.canAskAgain) {
    perm = await request();
    if (perm.granted) return true;
  }
  if (!perm.canAskAgain) {
    showAlert(
      'Permiso necesario',
      `Activa el acceso a ${label} en Ajustes para adjuntar tu comprobante.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir Ajustes', onPress: () => { Linking.openSettings(); } },
      ]
    );
  } else {
    showAlert('Permiso necesario', `Necesitamos acceso a ${label} para adjuntar tu comprobante.`);
  }
  return false;
}

const formatSize = (b?: number | null) =>
  !b ? '' : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`;

export default function SolicitudesScreen() {
  const { isAdmin } = useAuth();
  
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [newRequest, setNewRequest] = useState({
    type: 'vacation',
    start_date: new Date(),
    end_date: new Date(),
    reason: '',
  });
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [submitStep, setSubmitStep] = useState<'' | 'uploading' | 'saving'>('');
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
      showAlert('Error', 'Por favor ingresa una razón para la solicitud');
      return;
    }

    setIsSubmitting(true);
    try {
      let attachment_id: string | undefined;
      if (attachment) {
        setSubmitStep('uploading');
        const up = await uploadProofFile(attachment);
        attachment_id = up.file_id;
      }
      setSubmitStep('saving');
      await createLeaveRequest({
        type: newRequest.type,
        start_date: newRequest.start_date.toISOString().split('T')[0],
        end_date: newRequest.end_date.toISOString().split('T')[0],
        reason: newRequest.reason,
        attachment_id,
      });

      showAlert('Éxito', 'Solicitud creada correctamente');
      setShowNewRequestModal(false);
      resetNewRequest();
      loadRequests();
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.detail || error.message || 'No se pudo crear la solicitud');
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
    }
  };

  const resetNewRequest = () => {
    setNewRequest({
      type: 'vacation',
      start_date: new Date(),
      end_date: new Date(),
      reason: '',
    });
    setAttachment(null);
  };

  const acceptFile = (f: Attachment) => {
    if (f.size && f.size > MAX_FILE_BYTES) {
      showAlert('Archivo muy grande', 'El comprobante no puede superar 5 MB.');
      return;
    }
    setAttachment(f);
  };

  const fromImageAsset = (a: ImagePicker.ImagePickerAsset): Attachment => ({
    uri: a.uri,
    name: a.fileName || `comprobante-${Date.now()}.jpg`,
    mimeType: a.mimeType || 'image/jpeg',
    size: a.fileSize,
  });

  const handlePickGallery = async () => {
    if (Platform.OS !== 'web') {
      const ok = await ensurePermission(
        ImagePicker.getMediaLibraryPermissionsAsync,
        ImagePicker.requestMediaLibraryPermissionsAsync,
        'tus fotos'
      );
      if (!ok) return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) acceptFile(fromImageAsset(result.assets[0]));
  };

  const handleTakePhoto = async () => {
    if (Platform.OS !== 'web') {
      const ok = await ensurePermission(
        ImagePicker.getCameraPermissionsAsync,
        ImagePicker.requestCameraPermissionsAsync,
        'la cámara'
      );
      if (!ok) return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) acceptFile(fromImageAsset(result.assets[0]));
  };

  const handlePickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      acceptFile({ uri: a.uri, name: a.name || 'comprobante.pdf', mimeType: a.mimeType || 'application/pdf', size: a.size });
    }
  };

  const openAttachment = async (fileId: string) => {
    try {
      const url = await getFileUrl(fileId);
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch {
      showAlert('Error', 'No se pudo abrir el comprobante');
    }
  };

  const handleApproveReject = async (requestId: string, status: 'approved' | 'rejected') => {
    const actionText = status === 'approved' ? 'aprobar' : 'rechazar';
    showAlert(
      'Confirmar',
      `¿Estás seguro de ${actionText} esta solicitud?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await approveLeaveRequest(requestId, status);
              showAlert('Éxito', `Solicitud ${status === 'approved' ? 'aprobada' : 'rechazada'}`);
              loadRequests();
            } catch (error) {
              showAlert('Error', 'No se pudo actualizar la solicitud');
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
      case 'telework':
        return 'Teletrabajo';
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
        <Text style={styles.headerTitle}>Novedades</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' }]}
            onPress={() => setShowExport(true)}
            testID="open-export-btn"
          >
            <Ionicons name="download-outline" size={20} color="#122c2a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowNewRequestModal(true)}
            testID="open-new-leave-btn"
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <ExportNovedadesModal visible={showExport} onClose={() => setShowExport(false)} isAdmin={!!isAdmin} />

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

              {request.attachment?.file_id ? (
                <TouchableOpacity
                  style={styles.documentIndicator}
                  onPress={() => openAttachment(request.attachment.file_id)}
                  testID={`view-attachment-${request._id}`}
                >
                  <Ionicons
                    name={request.attachment.content_type === 'application/pdf' ? 'document-text' : 'image'}
                    size={16}
                    color="#b68a2e"
                  />
                  <Text style={styles.documentText} numberOfLines={1}>
                    {request.attachment.filename}
                  </Text>
                  <Text style={styles.documentLink}>Ver</Text>
                </TouchableOpacity>
              ) : request.proof_document ? (
                <View style={styles.documentIndicator}>
                  <Ionicons name="document-attach" size={16} color="#122c2a" />
                  <Text style={styles.documentText}>Documento adjunto</Text>
                </View>
              ) : null}

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
        <KCAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Solicitud</Text>
              <TouchableOpacity onPress={() => setShowNewRequestModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView style={styles.modalScroll} bottomOffset={24} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Tipo de Novedad</Text>
              <View style={styles.typeButtons}>
                {['vacation', 'medical', 'normal', 'telework'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    testID={`leave-type-${type}`}
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

              <Text style={styles.label}>Comprobante (opcional)</Text>
              <Text style={styles.hint}>Foto o PDF, máximo 5 MB. Se enviará a los administradores.</Text>
              {attachment ? (
                <View style={styles.attachmentChip} testID="attachment-chip">
                  <Ionicons
                    name={attachment.mimeType === 'application/pdf' ? 'document-text' : 'image'}
                    size={22}
                    color="#b68a2e"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
                    {!!attachment.size && <Text style={styles.attachmentSize}>{formatSize(attachment.size)}</Text>}
                  </View>
                  <TouchableOpacity
                    onPress={() => setAttachment(null)}
                    style={styles.attachmentRemove}
                    disabled={isSubmitting}
                    testID="remove-attachment-btn"
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.attachRow}>
                  <TouchableOpacity style={styles.attachOption} onPress={handlePickGallery} testID="attach-gallery-btn">
                    <Ionicons name="images-outline" size={22} color="#122c2a" />
                    <Text style={styles.attachOptionText}>Galería</Text>
                  </TouchableOpacity>
                  {Platform.OS !== 'web' && (
                    <TouchableOpacity style={styles.attachOption} onPress={handleTakePhoto} testID="attach-camera-btn">
                      <Ionicons name="camera-outline" size={22} color="#122c2a" />
                      <Text style={styles.attachOptionText}>Cámara</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.attachOption} onPress={handlePickPdf} testID="attach-pdf-btn">
                    <Ionicons name="document-text-outline" size={22} color="#122c2a" />
                    <Text style={styles.attachOptionText}>PDF</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleCreateRequest}
                disabled={isSubmitting}
                testID="submit-leave-btn"
              >
                {isSubmitting && <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />}
                <Text style={styles.submitButtonText}>
                  {submitStep === 'uploading'
                    ? 'Subiendo comprobante...'
                    : isSubmitting
                    ? 'Creando...'
                    : 'Crear Solicitud'}
                </Text>
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>
        </KCAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f2f4f6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -0.5,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#122c2a',
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
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
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
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: -4,
    marginBottom: 10,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 8,
  },
  attachOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: 64,
    backgroundColor: '#f5f5f7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    gap: 4,
  },
  attachOptionText: {
    fontSize: 13,
    color: '#122c2a',
    fontWeight: '600',
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#fdf8ee',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b68a2e',
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#122c2a',
  },
  attachmentSize: {
    fontSize: 12,
    color: '#6b7280',
  },
  attachmentRemove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#122c2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentLink: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '800',
    color: '#b68a2e',
    paddingLeft: 8,
  },
  submitButton: {
    backgroundColor: '#122c2a',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
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
