import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getAbsentEmployees,
  getBirthdays,
  getEmployeeOfMonth,
  seedDatabase,
} from '@/src/utils/api';

export default function HomeScreen() {
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();
  const [absentEmployees, setAbsentEmployees] = useState<any[]>([]);
  const [birthdays, setBirthdays] = useState<any>({ today: [], upcoming: [] });
  const [employeeOfMonth, setEmployeeOfMonth] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [absent, birthdayData, employee] = await Promise.all([
        getAbsentEmployees(),
        getBirthdays(),
        getEmployeeOfMonth(),
      ]);
      
      setAbsentEmployees(absent);
      setBirthdays(birthdayData);
      setEmployeeOfMonth(employee);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      if (error.response?.status === 404 || error.message?.includes('404')) {
        // Database might be empty, offer to seed
        Alert.alert(
          'Base de datos vacía',
          '¿Deseas cargar datos de ejemplo?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Sí, cargar datos',
              onPress: handleSeedDatabase,
            },
          ]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDatabase = async () => {
    try {
      await seedDatabase();
      Alert.alert('Éxito', 'Datos de ejemplo cargados correctamente');
      loadDashboardData();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los datos de ejemplo');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }, []);

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'airplane';
      case 'medical':
        return 'medical';
      case 'normal':
        return 'time';
      default:
        return 'information-circle';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('@/assets/images/conactivos-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.brandTextContainer}>
            <Text style={styles.greeting}>Hola, {user?.name?.split(' ')[0]}</Text>
            <Text style={styles.role}>{user?.position || user?.role}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {isAdmin && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/reportes' as any)}
              testID="reports-btn"
            >
              <Ionicons name="analytics" size={22} color="#122c2a" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/empleados' as any)}
            testID="employees-btn"
          >
            <Ionicons name="people" size={22} color="#122c2a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/perfil' as any)}
            testID="profile-btn"
          >
            <Ionicons name="person-circle" size={22} color="#122c2a" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Employee of the Month */}
        {employeeOfMonth && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="star" size={24} color="#b68a2e" />
              <Text style={styles.cardTitle}>Empleado del Mes</Text>
            </View>
            <View style={styles.employeeOfMonth}>
              <View style={styles.employeeAvatar}>
                {employeeOfMonth.profile_photo ? (
                  <Image
                    source={{ uri: employeeOfMonth.profile_photo }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons name="person" size={40} color="#122c2a" />
                )}
              </View>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{employeeOfMonth.name}</Text>
                <Text style={styles.employeePosition}>{employeeOfMonth.position}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Absent Employees */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-remove" size={24} color="#122c2a" />
            <Text style={styles.cardTitle}>Ausentes Hoy</Text>
          </View>
          {absentEmployees.length === 0 ? (
            <Text style={styles.emptyText}>No hay empleados ausentes hoy</Text>
          ) : (
            absentEmployees.map((absent, index) => (
              <View key={index} style={styles.listItem}>
                <View style={styles.listItemIcon}>
                  <Ionicons name={getTypeIcon(absent.type)} size={20} color="#122c2a" />
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{absent.name}</Text>
                  <Text style={styles.listItemSubtitle}>
                    {getTypeLabel(absent.type)} • Hasta: {absent.until}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Birthdays Today */}
        {birthdays.today.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="gift" size={24} color="#b68a2e" />
              <Text style={styles.cardTitle}>Cumpleaños de Hoy</Text>
            </View>
            {birthdays.today.map((person: any) => (
              <View key={person._id} style={styles.listItem}>
                <View style={styles.listItemIcon}>
                  <Ionicons name="cake" size={20} color="#b68a2e" />
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{person.name}</Text>
                  <Text style={styles.listItemSubtitle}>{person.position}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Upcoming Birthdays */}
        {birthdays.upcoming.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar" size={24} color="#122c2a" />
              <Text style={styles.cardTitle}>Próximos Cumpleaños</Text>
            </View>
            {birthdays.upcoming.slice(0, 5).map((person: any) => (
              <View key={person._id} style={styles.listItem}>
                <View style={styles.listItemIcon}>
                  <Text style={styles.daysUntil}>{person.days_until}d</Text>
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{person.name}</Text>
                  <Text style={styles.listItemSubtitle}>{person.position}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 44,
    height: 44,
    marginRight: 10,
  },
  brandTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#122c2a',
  },
  role: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#122c2a',
    marginLeft: 8,
  },
  employeeOfMonth: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#b68a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#122c2a',
  },
  employeePosition: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  daysUntil: {
    fontSize: 12,
    fontWeight: '600',
    color: '#122c2a',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
