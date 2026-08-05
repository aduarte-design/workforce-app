import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getAbsentEmployees,
  getBirthdays,
  getEmployeeOfMonth,
  getGoals,
  getCapsules,
  getKudos,
  getLeaveRequests,
} from '@/src/utils/api';

export default function HomeScreen() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  
  const [data, setData] = useState<any>({
    absent: [],
    birthdays: { today: [], upcoming: [] },
    employeeOfMonth: null,
    goal: null,
    capsules: [],
    kudos: [],
    leaves: [],
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    try {
      const [absent, birthdayData, employee, goal, capsules, kudos, leaves] = await Promise.all([
        getAbsentEmployees(),
        getBirthdays(),
        getEmployeeOfMonth(),
        getGoals(),
        getCapsules(),
        getKudos(),
        getLeaveRequests(),
      ]);
      
      setData({
        absent,
        birthdays: birthdayData,
        employeeOfMonth: employee,
        goal,
        capsules,
        kudos,
        leaves,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }, []);

  const todayCapsule = data.capsules.find((c: any) => {
    const today = new Date().toISOString().split('T')[0];
    return c.date === today;
  }) || data.capsules[0];

  const pendingLeaves = data.leaves.filter((l: any) => l.status === 'pending').length;
  const goalPercentage = data.goal?.percentage || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {user?.name?.split(' ')[0]}</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <View style={styles.headerActions}>
          {isAdmin && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/reportes' as any)}
              testID="reports-btn"
            >
              <Ionicons name="stats-chart" size={18} color="#122c2a" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/empleados' as any)}
            testID="employees-btn"
          >
            <Ionicons name="people" size={18} color="#122c2a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/perfil' as any)}
            testID="profile-btn"
          >
            {user?.profile_photo ? (
              <Image source={{ uri: user.profile_photo }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={18} color="#fff" />
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
        {/* Hero Card - Employee of Month */}
        {data.employeeOfMonth && (
          <TouchableOpacity
            style={styles.heroCard}
            onPress={() => router.push(`/empleados/${data.employeeOfMonth._id}` as any)}
            activeOpacity={0.9}
          >
            <View style={styles.heroTop}>
              <View style={styles.heroLabel}>
                <Ionicons name="star" size={12} color="#b68a2e" />
                <Text style={styles.heroLabelText}>EMPLEADO DEL MES</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#b68a2e" />
            </View>
            <View style={styles.heroContent}>
              <View style={styles.heroAvatar}>
                {data.employeeOfMonth.profile_photo ? (
                  <Image source={{ uri: data.employeeOfMonth.profile_photo }} style={styles.heroAvatarImg} />
                ) : (
                  <Ionicons name="person" size={22} color="#b68a2e" />
                )}
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{data.employeeOfMonth.name}</Text>
                <Text style={styles.heroPosition}>{data.employeeOfMonth.position}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Grid Row 1: Ausentes + Cumpleaños */}
        <View style={styles.gridRow}>
          <View style={styles.gridCard}>
            <View style={styles.gridCardHeader}>
              <View style={[styles.miniIcon, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="person-remove" size={14} color="#ef4444" />
              </View>
              <Text style={styles.gridCardLabel}>Ausentes</Text>
            </View>
            <Text style={styles.gridNumber}>{data.absent.length}</Text>
            <Text style={styles.gridSubtext}>hoy</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.gridCardHeader}>
              <View style={[styles.miniIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="gift" size={14} color="#b68a2e" />
              </View>
              <Text style={styles.gridCardLabel}>Cumpleaños</Text>
            </View>
            <Text style={styles.gridNumber}>
              {data.birthdays.today.length + data.birthdays.upcoming.length}
            </Text>
            <Text style={styles.gridSubtext}>
              {data.birthdays.today.length > 0 ? `${data.birthdays.today.length} hoy` : 'próximos'}
            </Text>
          </View>
        </View>

        {/* Meta Comercial */}
        {data.goal && (
          <TouchableOpacity
            style={styles.metaCard}
            onPress={() => router.push('/(tabs)/metas' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.metaHeader}>
              <View style={styles.metaLabelBox}>
                <Ionicons name="trending-up" size={14} color="#122c2a" />
                <Text style={styles.metaLabel}>Meta comercial</Text>
              </View>
              <Text style={styles.metaPercent}>{goalPercentage.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(goalPercentage, 100)}%`,
                    backgroundColor: goalPercentage >= 100 ? '#10b981' : goalPercentage >= 75 ? '#b68a2e' : '#122c2a',
                  },
                ]}
              />
            </View>
            <View style={styles.metaFooter}>
              <Text style={styles.metaFooterText}>
                ${(data.goal.current_amount / 1000).toFixed(0)}K de ${(data.goal.goal_amount / 1000).toFixed(0)}K
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Grid Row 2: Solicitudes + Reconocimientos */}
        <View style={styles.gridRow}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push('/(tabs)/solicitudes' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.gridCardHeader}>
              <View style={[styles.miniIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="document-text" size={14} color="#3b82f6" />
              </View>
              <Text style={styles.gridCardLabel}>Permisos</Text>
            </View>
            <Text style={styles.gridNumber}>{pendingLeaves}</Text>
            <Text style={styles.gridSubtext}>pendientes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push('/(tabs)/kudos' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.gridCardHeader}>
              <View style={[styles.miniIcon, { backgroundColor: '#fce7f3' }]}>
                <Ionicons name="heart" size={14} color="#ec4899" />
              </View>
              <Text style={styles.gridCardLabel}>Reconocimientos</Text>
            </View>
            <Text style={styles.gridNumber}>{data.kudos.length}</Text>
            <Text style={styles.gridSubtext}>este mes</Text>
          </TouchableOpacity>
        </View>

        {/* Cápsula de hoy */}
        {todayCapsule && (
          <TouchableOpacity
            style={styles.capsuleCard}
            onPress={() => router.push('/(tabs)/capsulas' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.capsuleHeader}>
              <View style={[styles.miniIcon, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="bulb" size={14} color="#10b981" />
              </View>
              <Text style={styles.gridCardLabel}>Cápsula del día</Text>
            </View>
            <Text style={styles.capsuleTopic} numberOfLines={1}>{todayCapsule.topic}</Text>
            <Text style={styles.capsuleResponsible} numberOfLines={1}>
              Por {todayCapsule.responsible_employee_name}
            </Text>
          </TouchableOpacity>
        )}

        {/* Pausas Activas - Quick access */}
        <TouchableOpacity
          style={styles.pausasCard}
          onPress={() => router.push('/pausas' as any)}
          activeOpacity={0.9}
          testID="pausas-card"
        >
          <View style={styles.pausasIconWrap}>
            <Ionicons name="body" size={22} color="#b68a2e" />
          </View>
          <View style={styles.pausasBody}>
            <Text style={styles.pausasTitle}>Pausas Activas</Text>
            <Text style={styles.pausasSubtitle}>
              10 ejercicios · Recordatorios 11 AM y 4 PM
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#b68a2e" />
        </TouchableOpacity>

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
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
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#b68a2e',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroCard: {
    backgroundColor: '#122c2a',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b68a2e',
    letterSpacing: 0.8,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(182, 138, 46, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#b68a2e',
  },
  heroAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  heroPosition: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    minHeight: 92,
  },
  gridCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  miniIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCardLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  gridNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -0.8,
  },
  gridSubtext: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: -2,
  },
  metaCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  metaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#122c2a',
  },
  metaPercent: {
    fontSize: 22,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -0.5,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  metaFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  metaFooterText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  capsuleCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  capsuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  capsuleTopic: {
    fontSize: 15,
    fontWeight: '700',
    color: '#122c2a',
    marginBottom: 2,
  },
  capsuleResponsible: {
    fontSize: 12,
    color: '#6b7280',
  },
  pausasCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(182, 138, 46, 0.25)',
  },
  pausasIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pausasBody: {
    flex: 1,
  },
  pausasTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -0.3,
  },
  pausasSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});
