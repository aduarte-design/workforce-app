import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { getUser, getUserKudos, setEmployeeOfMonth } from '@/src/utils/api';

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
  const { isAdmin } = useAuth();
  
  const [employee, setEmployee] = useState<any>(null);
  const [kudos, setKudos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      Alert.alert('Error', 'No se pudo cargar el empleado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetEmployeeOfMonth = () => {
    Alert.alert(
      'Empleado del Mes',
      `¿Establecer a ${employee.name} como Empleado del Mes?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await setEmployeeOfMonth(id as string);
              Alert.alert('Éxito', 'Empleado del Mes actualizado');
              loadEmployee();
            } catch (error) {
              Alert.alert('Error', 'No se pudo actualizar');
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

          {isAdmin && !employee.is_employee_of_month && employee.role === 'employee' && (
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

          {employee.hire_date && (
            <View style={styles.infoRow}>
              <Ionicons name="briefcase-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Ingreso</Text>
                <Text style={styles.infoValue}>{employee.hire_date}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Kudos Received */}
        <View style={styles.card}>
          <View style={styles.kudosCardHeader}>
            <Ionicons name="heart" size={20} color="#ef4444" />
            <Text style={styles.cardTitle}>Kudos Recibidos ({kudos.length})</Text>
          </View>

          {kudos.length === 0 ? (
            <Text style={styles.emptyText}>Aún no ha recibido kudos</Text>
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
      </ScrollView>
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
});
