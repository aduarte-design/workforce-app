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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getKudos,
  createKudo,
  getKudosLeaderboard,
  getUsers,
} from '@/src/utils/api';

const CATEGORIES = [
  { id: 'teamwork', label: 'Trabajo en Equipo', icon: 'people', color: '#3b82f6' },
  { id: 'innovation', label: 'Innovación', icon: 'bulb', color: '#8b5cf6' },
  { id: 'leadership', label: 'Liderazgo', icon: 'ribbon', color: '#b68a2e' },
  { id: 'excellence', label: 'Excelencia', icon: 'trophy', color: '#f59e0b' },
  { id: 'helpful', label: 'Colaborador', icon: 'hand-left', color: '#10b981' },
];

export default function KudosScreen() {
  const { user } = useAuth();
  
  const [kudos, setKudos] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showKudoModal, setShowKudoModal] = useState(false);
  const [showEmployeeSelect, setShowEmployeeSelect] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'ranking'>('feed');
  const [kudoForm, setKudoForm] = useState({
    to_user_id: '',
    message: '',
    category: 'teamwork',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [kudosData, leaderboardData, employeesData] = await Promise.all([
        getKudos(),
        getKudosLeaderboard(),
        getUsers(),
      ]);
      setKudos(kudosData);
      setLeaderboard(leaderboardData);
      setEmployees(employeesData.filter((e: any) => e._id !== user?._id));
    } catch (error) {
      console.error('Error loading kudos:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleOpenModal = () => {
    setKudoForm({
      to_user_id: '',
      message: '',
      category: 'teamwork',
    });
    setShowKudoModal(true);
  };

  const handleSendKudo = async () => {
    if (!kudoForm.to_user_id) {
      Alert.alert('Error', 'Por favor selecciona un empleado');
      return;
    }
    if (!kudoForm.message.trim()) {
      Alert.alert('Error', 'Por favor escribe un mensaje');
      return;
    }

    setIsSubmitting(true);
    try {
      await createKudo(kudoForm);
      Alert.alert('¡Kudo enviado!', 'Tu reconocimiento ha sido enviado 🎉');
      setShowKudoModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo enviar el kudo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
  };

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const selectedEmployee = employees.find(
    (e) => e._id === kudoForm.to_user_id
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Reconocimientos</Text>
          <Text style={styles.headerSubtitle}>Reconoce a tus compañeros</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleOpenModal}
          testID="send-kudo-btn"
        >
          <Ionicons name="add" size={22} color="#122c2a" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>
            Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ranking' && styles.tabActive]}
          onPress={() => setActiveTab('ranking')}
        >
          <Text style={[styles.tabText, activeTab === 'ranking' && styles.tabTextActive]}>
            Top Reconocidos
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'feed' ? (
          kudos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Sé el primero en dar un kudo</Text>
            </View>
          ) : (
            kudos.map((kudo) => {
              const category = getCategoryInfo(kudo.category);
              return (
                <View key={kudo._id} style={styles.kudoCard}>
                  <View style={styles.kudoHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
                      <Ionicons name={category.icon as any} size={14} color="#fff" />
                      <Text style={styles.categoryText}>{category.label}</Text>
                    </View>
                    <Text style={styles.kudoTime}>{getRelativeTime(kudo.created_at)}</Text>
                  </View>

                  <View style={styles.kudoParticipants}>
                    <View style={styles.participantAvatar}>
                      <Ionicons name="person" size={20} color="#122c2a" />
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantText}>
                        <Text style={styles.participantName}>{kudo.from_user_name}</Text>
                        <Text style={styles.arrow}> → </Text>
                        <Text style={styles.participantName}>{kudo.to_user_name}</Text>
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.kudoMessage}>{kudo.message}</Text>
                </View>
              );
            })
          )
        ) : (
          leaderboard.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Aún no hay reconocimientos</Text>
            </View>
          ) : (
            leaderboard.map((entry, index) => (
              <View key={entry._id} style={styles.rankCard}>
                <View style={[styles.rankBadge, index < 3 && styles.topRankBadge]}>
                  {index === 0 && <Ionicons name="trophy" size={24} color="#b68a2e" />}
                  {index === 1 && <Ionicons name="medal" size={24} color="#9ca3af" />}
                  {index === 2 && <Ionicons name="medal" size={24} color="#c2410c" />}
                  {index > 2 && <Text style={styles.rankNumber}>{index + 1}</Text>}
                </View>

                <View style={styles.rankAvatar}>
                  {entry.profile_photo ? (
                    <Image source={{ uri: entry.profile_photo }} style={styles.rankAvatarImage} />
                  ) : (
                    <Ionicons name="person" size={28} color="#122c2a" />
                  )}
                </View>

                <View style={styles.rankInfo}>
                  <Text style={styles.rankName}>{entry.to_user_name}</Text>
                  <Text style={styles.rankPosition}>{entry.position}</Text>
                </View>

                <View style={styles.rankCount}>
                  <Ionicons name="heart" size={16} color="#ef4444" />
                  <Text style={styles.rankCountText}>{entry.count}</Text>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Send Kudo Modal */}
      <Modal
        visible={showKudoModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowKudoModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enviar Kudo</Text>
              <TouchableOpacity onPress={() => setShowKudoModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>Para</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowEmployeeSelect(!showEmployeeSelect)}
              >
                <Ionicons name="person-outline" size={20} color="#666" />
                <Text style={styles.selectText}>
                  {selectedEmployee ? selectedEmployee.name : 'Selecciona un compañero'}
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
                        kudoForm.to_user_id === employee._id && styles.employeeItemSelected,
                      ]}
                      onPress={() => {
                        setKudoForm({ ...kudoForm, to_user_id: employee._id });
                        setShowEmployeeSelect(false);
                      }}
                    >
                      <Text style={styles.employeeItemText}>{employee.name}</Text>
                      <Text style={styles.employeeItemPosition}>{employee.position}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Categoría</Text>
              <View style={styles.categoriesGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      kudoForm.category === cat.id && {
                        backgroundColor: cat.color,
                        borderColor: cat.color,
                      },
                    ]}
                    onPress={() => setKudoForm({ ...kudoForm, category: cat.id })}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={20}
                      color={kudoForm.category === cat.id ? '#fff' : cat.color}
                    />
                    <Text
                      style={[
                        styles.categoryOptionText,
                        kudoForm.category === cat.id && { color: '#fff' },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Mensaje</Text>
              <TextInput
                style={styles.textArea}
                value={kudoForm.message}
                onChangeText={(text) => setKudoForm({ ...kudoForm, message: text })}
                placeholder="Escribe un mensaje de reconocimiento..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={300}
              />
              <Text style={styles.charCount}>{kudoForm.message.length}/300</Text>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSendKudo}
                disabled={isSubmitting}
              >
                <Ionicons name="heart" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Enviando...' : 'Enviar Kudo'}
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
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#b68a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#b68a2e',
  },
  tabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
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
  kudoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  kudoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  kudoTime: {
    fontSize: 12,
    color: '#999',
  },
  kudoParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  participantInfo: {
    flex: 1,
  },
  participantText: {
    fontSize: 14,
    color: '#333',
  },
  participantName: {
    fontWeight: '600',
    color: '#122c2a',
  },
  arrow: {
    color: '#b68a2e',
    fontWeight: 'bold',
  },
  kudoMessage: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topRankBadge: {
    backgroundColor: '#fef3c7',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  rankAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#b68a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#122c2a',
  },
  rankPosition: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  rankCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  rankCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
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
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  employeeItemPosition: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 6,
  },
  categoryOptionText: {
    fontSize: 13,
    fontWeight: '500',
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
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#122c2a',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    marginBottom: 8,
    gap: 8,
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
