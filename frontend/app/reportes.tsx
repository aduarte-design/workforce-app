import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStats } from '@/src/utils/api';

export default function ReportsScreen() {
  const router = useRouter();
  
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, []);

  if (isLoading || !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#122c2a" />
        </View>
      </SafeAreaView>
    );
  }

  const approvalRate = stats.leaves.total > 0
    ? Math.round((stats.leaves.approved / stats.leaves.total) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#122c2a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reportes</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Employees Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="people" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.statNumber}>{stats.employees.total}</Text>
              <Text style={styles.statLabel}>Empleados</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="shield-checkmark" size={24} color="#b68a2e" />
              </View>
              <Text style={styles.statNumber}>{stats.employees.admins}</Text>
              <Text style={styles.statLabel}>Administradores</Text>
            </View>
          </View>
        </View>

        {/* Leaves Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Solicitudes de Permisos</Text>
          
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatLabel}>Total de Solicitudes</Text>
            <Text style={styles.bigStatNumber}>{stats.leaves.total}</Text>
            <Text style={styles.bigStatSubtext}>
              {stats.leaves.this_month} este mes
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="hourglass" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.statNumber}>{stats.leaves.pending}</Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </View>
              <Text style={styles.statNumber}>{stats.leaves.approved}</Text>
              <Text style={styles.statLabel}>Aprobadas</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </View>
              <Text style={styles.statNumber}>{stats.leaves.rejected}</Text>
              <Text style={styles.statLabel}>Rechazadas</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="analytics" size={24} color="#0284c7" />
              </View>
              <Text style={styles.statNumber}>{approvalRate}%</Text>
              <Text style={styles.statLabel}>Tasa de Aprobación</Text>
            </View>
          </View>
        </View>

        {/* By Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Solicitudes por Tipo</Text>
          <View style={styles.typeCard}>
            {[
              {
                label: 'Vacaciones',
                icon: 'airplane',
                color: '#3b82f6',
                count: stats.leaves.by_type.vacation,
              },
              {
                label: 'Citas Médicas',
                icon: 'medical',
                color: '#ef4444',
                count: stats.leaves.by_type.medical,
              },
              {
                label: 'Permisos Normales',
                icon: 'time',
                color: '#b68a2e',
                count: stats.leaves.by_type.normal,
              },
            ].map((item) => {
              const total = stats.leaves.total || 1;
              const percentage = Math.round((item.count / total) * 100);
              return (
                <View key={item.label} style={styles.typeRow}>
                  <View style={[styles.typeIcon, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View style={styles.typeInfo}>
                    <View style={styles.typeHeader}>
                      <Text style={styles.typeLabel}>{item.label}</Text>
                      <Text style={styles.typeCount}>{item.count}</Text>
                    </View>
                    <View style={styles.typeBarContainer}>
                      <View
                        style={[
                          styles.typeBar,
                          { width: `${percentage}%`, backgroundColor: item.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.typePercentage}>{percentage}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Kudos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reconocimientos</Text>
          <View style={styles.bigStatCard}>
            <View style={styles.kudosHeader}>
              <Ionicons name="heart" size={32} color="#ef4444" />
            </View>
            <Text style={styles.bigStatLabel}>Total de Kudos</Text>
            <Text style={styles.bigStatNumber}>{stats.kudos.total}</Text>
            <Text style={styles.bigStatSubtext}>Reconocimientos enviados</Text>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#122c2a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#122c2a',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#122c2a',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  bigStatCard: {
    backgroundColor: '#122c2a',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  bigStatLabel: {
    fontSize: 14,
    color: '#b68a2e',
    fontWeight: '500',
  },
  bigStatNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 8,
  },
  bigStatSubtext: {
    fontSize: 13,
    color: '#ccc',
  },
  kudosHeader: {
    marginBottom: 8,
  },
  typeCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeInfo: {
    flex: 1,
  },
  typeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  typeCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#122c2a',
  },
  typeBarContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  typeBar: {
    height: '100%',
    borderRadius: 4,
  },
  typePercentage: {
    fontSize: 11,
    color: '#666',
    textAlign: 'right',
  },
});
