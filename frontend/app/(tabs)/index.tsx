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
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getAbsentEmployees,
  getBirthdays,
  getEmployeeOfMonth,
  seedDatabase,
} from '@/src/utils/api';

export default function HomeScreen() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  
  const [absentEmployees, setAbsentEmployees] = useState<any[]>([]);
  const [birthdays, setBirthdays] = useState<any>({ today: [], upcoming: [] });
  const [employeeOfMonth, setEmployeeOfMonth] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
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
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }, []);

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

  const getTypeIcon = (type: string): any => {
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

  const totalBirthdays = birthdays.today.length + birthdays.upcoming.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.helpBadge}>
            <Image
              source={require('@/assets/images/conactivos-logo.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <Text style={styles.helpText}>{user?.name?.split(' ')[0]}</Text>
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
            style={styles.profileAvatarButton}
            onPress={() => router.push('/perfil' as any)}
            testID="profile-btn"
          >
            {user?.profile_photo ? (
              <Image source={{ uri: user.profile_photo }} style={styles.profileAvatarImage} />
            ) : (
              <Ionicons name="person" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Big Title */}
        <Text style={styles.pageTitle}>Vista general</Text>

        {/* Hero Card - Employee of the Month */}
        {employeeOfMonth && (
          <TouchableOpacity style={styles.heroCardWrapper} activeOpacity={0.9}>
            <LinearGradient
              colors={['#1a3d3a', '#122c2a', '#0a1c1a']}
              style={styles.heroCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroHeader}>
                <View style={styles.heroLabelRow}>
                  <Ionicons name="star" size={16} color="#b68a2e" />
                  <Text style={styles.heroLabel}>Empleado del Mes</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
              </View>

              <View style={styles.heroContent}>
                <View style={styles.heroAvatar}>
                  {employeeOfMonth.profile_photo ? (
                    <Image source={{ uri: employeeOfMonth.profile_photo }} style={styles.heroAvatarImg} />
                  ) : (
                    <Ionicons name="person" size={36} color="#b68a2e" />
                  )}
                </View>
                <View style={styles.heroInfo}>
                  <Text style={styles.heroName}>{employeeOfMonth.name}</Text>
                  <Text style={styles.heroPosition}>{employeeOfMonth.position}</Text>
                </View>
              </View>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatNumber}>{absentEmployees.length}</Text>
                  <Text style={styles.heroStatLabel}>Ausentes hoy</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatNumber}>{totalBirthdays}</Text>
                  <Text style={styles.heroStatLabel}>Cumpleaños</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Section: Ausentes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ausentes hoy</Text>
        </View>
        
        {absentEmployees.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={styles.emptyCardText}>No hay ausentes hoy</Text>
          </View>
        ) : (
          <View style={styles.horizontalCards}>
            {absentEmployees.map((absent, index) => (
              <View
                key={index}
                style={[
                  styles.absentCard,
                  { backgroundColor: absent.type === 'medical' ? '#fee2e2' : absent.type === 'vacation' ? '#dbeafe' : '#fef3c7' }
                ]}
              >
                <View
                  style={[
                    styles.absentIcon,
                    { backgroundColor: absent.type === 'medical' ? '#ef4444' : absent.type === 'vacation' ? '#3b82f6' : '#b68a2e' }
                  ]}
                >
                  <Ionicons name={getTypeIcon(absent.type)} size={18} color="#fff" />
                </View>
                <Text style={styles.absentName}>{absent.name}</Text>
                <Text style={styles.absentType}>{getTypeLabel(absent.type)}</Text>
                <Text style={styles.absentUntil}>Hasta {absent.until}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Section: Cumpleaños de Hoy */}
        {birthdays.today.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🎉 Cumpleaños de hoy</Text>
            </View>
            {birthdays.today.map((person: any) => (
              <LinearGradient
                key={person._id}
                colors={['#b68a2e', '#d4a444']}
                style={styles.birthdayTodayCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.birthdayAvatar}>
                  <Ionicons name="gift" size={28} color="#fff" />
                </View>
                <View style={styles.birthdayInfo}>
                  <Text style={styles.birthdayName}>{person.name}</Text>
                  <Text style={styles.birthdayPosition}>{person.position}</Text>
                </View>
              </LinearGradient>
            ))}
          </>
        )}

        {/* Section: Próximos Cumpleaños */}
        {birthdays.upcoming.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Próximos cumpleaños</Text>
            </View>
            
            <View style={styles.upcomingList}>
              {birthdays.upcoming.slice(0, 5).map((person: any) => (
                <View key={person._id} style={styles.upcomingItem}>
                  <View style={styles.upcomingAvatar}>
                    <Ionicons name="person" size={20} color="#b68a2e" />
                  </View>
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingName}>{person.name}</Text>
                    <Text style={styles.upcomingPosition}>{person.position}</Text>
                  </View>
                  <View style={styles.upcomingDays}>
                    <Text style={styles.upcomingDaysNumber}>{person.days_until}</Text>
                    <Text style={styles.upcomingDaysLabel}>días</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Bottom Spacing for Tab Bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  headerLeft: {
    flex: 1,
  },
  helpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignSelf: 'flex-start',
    gap: 6,
  },
  logoIcon: {
    width: 20,
    height: 20,
    tintColor: '#122c2a',
  },
  helpText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#122c2a',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileAvatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#b68a2e',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#122c2a',
    marginTop: 8,
    marginBottom: 20,
    letterSpacing: -1,
  },
  heroCardWrapper: {
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroCard: {
    padding: 20,
    borderRadius: 24,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroLabel: {
    color: '#b68a2e',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(182, 138, 46, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#b68a2e',
  },
  heroAvatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  heroPosition: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroStatNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  heroStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#122c2a',
    letterSpacing: -0.3,
  },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyCardText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  horizontalCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  absentCard: {
    width: '48%',
    padding: 14,
    borderRadius: 16,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  absentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  absentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#122c2a',
  },
  absentType: {
    fontSize: 12,
    color: '#122c2a',
    opacity: 0.8,
    marginTop: 2,
  },
  absentUntil: {
    fontSize: 11,
    color: '#122c2a',
    opacity: 0.6,
    marginTop: 6,
  },
  birthdayTodayCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  birthdayAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  birthdayInfo: {
    flex: 1,
  },
  birthdayName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  birthdayPosition: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  upcomingList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 24,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  upcomingAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#122c2a',
  },
  upcomingPosition: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  upcomingDays: {
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 50,
  },
  upcomingDaysNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#122c2a',
  },
  upcomingDaysLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  bottomSpacer: {
    height: 120,
  },
});
