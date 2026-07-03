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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { getGoals, updateGoal } from '@/src/utils/api';

export default function MetasScreen() {
  const { isAdmin } = useAuth();
  
  const [goal, setGoal] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    goal_amount: '',
    current_amount: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadGoal();
  }, []);

  const loadGoal = async () => {
    try {
      const data = await getGoals();
      setGoal(data);
    } catch (error) {
      console.error('Error loading goal:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGoal();
    setRefreshing(false);
  }, []);

  const handleOpenEditModal = () => {
    if (goal) {
      setEditForm({
        goal_amount: goal.goal_amount.toString(),
        current_amount: goal.current_amount.toString(),
      });
      setShowEditModal(true);
    }
  };

  const handleSaveGoal = async () => {
    const goalAmount = parseFloat(editForm.goal_amount);
    const currentAmount = parseFloat(editForm.current_amount);

    if (isNaN(goalAmount) || goalAmount < 0) {
      Alert.alert('Error', 'Por favor ingresa un monto de meta válido');
      return;
    }

    if (isNaN(currentAmount) || currentAmount < 0) {
      Alert.alert('Error', 'Por favor ingresa un monto actual válido');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateGoal(goal._id, {
        goal_amount: goalAmount,
        current_amount: currentAmount,
      });

      Alert.alert('Éxito', 'Meta actualizada correctamente');
      setShowEditModal(false);
      loadGoal();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la meta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month - 1];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#10b981';
    if (percentage >= 75) return '#b68a2e';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Metas Comerciales</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="stats-chart-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Cargando meta...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progressColor = getProgressColor(goal.percentage);
  const remaining = goal.goal_amount - goal.current_amount;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Metas Comerciales</Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleOpenEditModal}
          >
            <Ionicons name="create" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.periodCard}>
          <Ionicons name="calendar" size={24} color="#122c2a" />
          <Text style={styles.periodText}>
            {getMonthName(goal.month)} {goal.year}
          </Text>
        </View>

        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalLabel}>Meta del Mes</Text>
            <Text style={styles.goalAmount}>{formatCurrency(goal.goal_amount)}</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(goal.percentage, 100)}%`, backgroundColor: progressColor },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: progressColor }]}>
              {goal.percentage.toFixed(1)}%
            </Text>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={32} color="#10b981" />
              <Text style={styles.statLabel}>Alcanzado</Text>
              <Text style={styles.statValue}>{formatCurrency(goal.current_amount)}</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="trending-up" size={32} color="#f59e0b" />
              <Text style={styles.statLabel}>Restante</Text>
              <Text style={styles.statValue}>
                {remaining > 0 ? formatCurrency(remaining) : formatCurrency(0)}
              </Text>
            </View>
          </View>

          {goal.percentage >= 100 && (
            <View style={styles.achievementBanner}>
              <Ionicons name="trophy" size={32} color="#b68a2e" />
              <Text style={styles.achievementText}>¡Meta Cumplida!</Text>
            </View>
          )}

          {goal.percentage < 100 && goal.percentage >= 75 && (
            <View style={styles.encouragementBanner}>
              <Ionicons name="rocket" size={24} color="#122c2a" />
              <Text style={styles.encouragementText}>¡Casi llegamos! Sigue así</Text>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color="#666" />
            <Text style={styles.infoText}>
              {isAdmin
                ? 'Toca el botón de editar para actualizar la meta y el avance'
                : 'Esta información es actualizada por el equipo administrativo'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Meta</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>Meta del Mes (COP)</Text>
              <TextInput
                style={styles.input}
                value={editForm.goal_amount}
                onChangeText={(text) => setEditForm({ ...editForm, goal_amount: text })}
                placeholder="0"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Monto Actual (COP)</Text>
              <TextInput
                style={styles.input}
                value={editForm.current_amount}
                onChangeText={(text) => setEditForm({ ...editForm, current_amount: text })}
                placeholder="0"
                keyboardType="numeric"
              />

              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>Vista Previa:</Text>
                {editForm.goal_amount && editForm.current_amount && (
                  <>
                    <Text style={styles.previewText}>
                      Meta: {formatCurrency(parseFloat(editForm.goal_amount) || 0)}
                    </Text>
                    <Text style={styles.previewText}>
                      Actual: {formatCurrency(parseFloat(editForm.current_amount) || 0)}
                    </Text>
                    <Text style={styles.previewText}>
                      Porcentaje:{' '}
                      {parseFloat(editForm.goal_amount) > 0
                        ? (
                            (parseFloat(editForm.current_amount) /
                              parseFloat(editForm.goal_amount)) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </Text>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSaveGoal}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#122c2a',
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#122c2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  periodText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#122c2a',
    marginLeft: 12,
  },
  goalCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  goalHeader: {
    marginBottom: 24,
  },
  goalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  goalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#122c2a',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#122c2a',
    textAlign: 'center',
  },
  achievementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  achievementText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#b68a2e',
  },
  encouragementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  encouragementText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#122c2a',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
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
  previewContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#122c2a',
    marginBottom: 8,
  },
  previewText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
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
