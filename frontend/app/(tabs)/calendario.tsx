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
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '@/src/utils/api';

export default function CalendarioScreen() {
  const { isAdmin } = useAuth();
  
  const [events, setEvents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: new Date(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, []);

  const handleOpenModal = (event?: any) => {
    if (event) {
      setEditingEvent(event);
      setEventForm({
        title: event.title,
        description: event.description || '',
        date: new Date(event.date),
      });
    } else {
      setEditingEvent(null);
      setEventForm({
        title: '',
        description: '',
        date: new Date(),
      });
    }
    setShowEventModal(true);
  };

  const handleCloseModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
    setEventForm({ title: '', description: '', date: new Date() });
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) {
      Alert.alert('Error', 'Por favor ingresa un título para el evento');
      return;
    }

    setIsSubmitting(true);
    try {
      const eventData = {
        title: eventForm.title,
        description: eventForm.description,
        date: eventForm.date.toISOString().split('T')[0],
      };

      if (editingEvent) {
        await updateEvent(editingEvent._id, eventData);
        Alert.alert('Éxito', 'Evento actualizado correctamente');
      } else {
        await createEvent(eventData);
        Alert.alert('Éxito', 'Evento creado correctamente');
      }

      handleCloseModal();
      loadEvents();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar el evento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    Alert.alert('Eliminar Evento', '¿Estás seguro de eliminar este evento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(eventId);
            Alert.alert('Éxito', 'Evento eliminado');
            loadEvents();
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el evento');
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
    const eventDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate >= today;
  };

  const upcomingEvents = events.filter((e) => isUpcoming(e.date));
  const pastEvents = events.filter((e) => !isUpcoming(e.date));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Eventos</Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleOpenModal()}
          >
            <Ionicons name="add" size={24} color="#122c2a" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hay eventos programados</Text>
          </View>
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Próximos Eventos</Text>
                {upcomingEvents.map((event) => (
                  <View key={event._id} style={styles.eventCard}>
                    <View style={styles.eventDateBadge}>
                      <Text style={styles.eventDay}>
                        {new Date(event.date).getDate()}
                      </Text>
                      <Text style={styles.eventMonth}>
                        {new Date(event.date).toLocaleDateString('es-ES', { month: 'short' })}
                      </Text>
                    </View>
                    
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      {event.description && (
                        <Text style={styles.eventDescription}>{event.description}</Text>
                      )}
                      <Text style={styles.eventFullDate}>{formatDate(event.date)}</Text>
                    </View>

                    {isAdmin && (
                      <View style={styles.eventActions}>
                        <TouchableOpacity
                          style={styles.iconActionButton}
                          onPress={() => handleOpenModal(event)}
                        >
                          <Ionicons name="create-outline" size={20} color="#122c2a" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconActionButton}
                          onPress={() => handleDeleteEvent(event._id)}
                        >
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}

            {pastEvents.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Eventos Pasados</Text>
                {pastEvents.map((event) => (
                  <View key={event._id} style={[styles.eventCard, styles.pastEventCard]}>
                    <View style={[styles.eventDateBadge, styles.pastEventDateBadge]}>
                      <Text style={styles.eventDay}>
                        {new Date(event.date).getDate()}
                      </Text>
                      <Text style={styles.eventMonth}>
                        {new Date(event.date).toLocaleDateString('es-ES', { month: 'short' })}
                      </Text>
                    </View>
                    
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      {event.description && (
                        <Text style={styles.eventDescription}>{event.description}</Text>
                      )}
                      <Text style={styles.eventFullDate}>{formatDate(event.date)}</Text>
                    </View>

                    {isAdmin && (
                      <View style={styles.eventActions}>
                        <TouchableOpacity
                          style={styles.iconActionButton}
                          onPress={() => handleDeleteEvent(event._id)}
                        >
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Event Modal */}
      <Modal
        visible={showEventModal}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>Título</Text>
              <TextInput
                style={styles.input}
                value={eventForm.title}
                onChangeText={(text) => setEventForm({ ...eventForm, title: text })}
                placeholder="Título del evento"
              />

              <Text style={styles.label}>Descripción (Opcional)</Text>
              <TextInput
                style={styles.textArea}
                value={eventForm.description}
                onChangeText={(text) => setEventForm({ ...eventForm, description: text })}
                placeholder="Descripción del evento..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.label}>Fecha</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <Text style={styles.dateText}>
                  {eventForm.date.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={eventForm.date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) {
                      setEventForm({ ...eventForm, date });
                    }
                  }}
                />
              )}

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSaveEvent}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Guardando...' : editingEvent ? 'Actualizar' : 'Crear Evento'}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#122c2a',
    marginBottom: 12,
    marginTop: 8,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pastEventCard: {
    opacity: 0.6,
  },
  eventDateBadge: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#122c2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pastEventDateBadge: {
    backgroundColor: '#999',
  },
  eventDay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  eventMonth: {
    fontSize: 12,
    color: '#fff',
    textTransform: 'uppercase',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#122c2a',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eventFullDate: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize',
  },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
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
    maxHeight: '80%',
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
