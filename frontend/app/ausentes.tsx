import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAbsentEmployees } from '@/src/utils/api';

const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    const [y, mm, dd] = iso.split('-');
    const day = parseInt(dd, 10);
    const monthIdx = parseInt(mm, 10) - 1;
    if (Number.isNaN(day) || Number.isNaN(monthIdx)) return iso;
    return `${day} ${MONTHS[monthIdx]} ${y}`;
  } catch {
    return iso;
  }
}

function formatRange(start?: string, end?: string): string {
  if (!start || !end) return '';
  if (start === end) return formatDate(start);
  return `${formatDate(start)} → ${formatDate(end)}`;
}

const TYPE_INFO: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  vacation: { label: 'Vacaciones',   icon: 'sunny',   color: '#f59e0b', bg: '#fef3c7' },
  medical:  { label: 'Cita médica',  icon: 'medkit',  color: '#dc2626', bg: '#fee2e2' },
  normal:   { label: 'Permiso',      icon: 'time',    color: '#3b82f6', bg: '#dbeafe' },
};

type Absent = {
  _id: string;
  name: string;
  position: string;
  profile_photo?: string | null;
  type: string;
  reason: string;
  start_date: string;
  end_date: string;
};

export default function AusentesScreen() {
  const router = useRouter();
  const [absents, setAbsents] = useState<Absent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getAbsentEmployees();
      setAbsents(data || []);
    } catch (e) {
      console.error('Error loading absent employees:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color="#122c2a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ausentes hoy</Text>
          <Text style={styles.subtitle}>
            {absents.length} {absents.length === 1 ? 'persona ausente' : 'personas ausentes'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#122c2a" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {absents.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No hay personas ausentes hoy</Text>
            </View>
          ) : (
            absents.map((a) => {
              const info = TYPE_INFO[a.type] || TYPE_INFO.normal;
              return (
                <View key={a._id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      {a.profile_photo ? (
                        <Image source={{ uri: a.profile_photo }} style={styles.avatarImg} />
                      ) : (
                        <Ionicons name="person" size={22} color="#122c2a" />
                      )}
                    </View>
                    <View style={styles.nameBox}>
                      <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
                      <Text style={styles.position} numberOfLines={1}>{a.position}</Text>
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: info.bg }]}>
                      <Ionicons name={info.icon} size={12} color={info.color} />
                      <Text style={[styles.typeBadgeText, { color: info.color }]}>{info.label}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                    <Text style={styles.detailLabel}>Fechas</Text>
                    <Text style={styles.detailValue}>{formatRange(a.start_date, a.end_date)}</Text>
                  </View>

                  {!!a.reason && (
                    <View style={styles.detailRow}>
                      <Ionicons name="chatbox-ellipses-outline" size={14} color="#6b7280" />
                      <Text style={styles.detailLabel}>Motivo</Text>
                      <Text style={[styles.detailValue, styles.reason]} numberOfLines={3}>
                        {a.reason}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  nameBox: { flex: 1 },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#122c2a',
    letterSpacing: -0.2,
  },
  position: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    width: 62,
  },
  detailValue: {
    fontSize: 13,
    color: '#122c2a',
    fontWeight: '600',
    flex: 1,
  },
  reason: {
    fontWeight: '500',
    color: '#374151',
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
});
