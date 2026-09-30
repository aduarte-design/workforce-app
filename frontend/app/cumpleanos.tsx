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
import { getBirthdays } from '@/src/utils/api';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatBirthday(iso: string): string {
  // Expected format YYYY-MM-DD → "5 de agosto"
  try {
    const [, mm, dd] = iso.split('-');
    const monthIdx = parseInt(mm, 10) - 1;
    const day = parseInt(dd, 10);
    if (Number.isNaN(day) || Number.isNaN(monthIdx)) return iso;
    return `${day} de ${MONTHS[monthIdx]}`;
  } catch {
    return iso;
  }
}

type Person = {
  _id: string;
  name: string;
  position: string;
  birthdate: string;
  profile_photo?: string | null;
  days_until?: number;
};

export default function CumpleanosScreen() {
  const router = useRouter();
  const [today, setToday] = useState<Person[]>([]);
  const [upcoming, setUpcoming] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getBirthdays();
      setToday(data.today || []);
      setUpcoming(data.upcoming || []);
    } catch (e) {
      console.error('Error loading birthdays:', e);
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

  const totalCount = today.length + upcoming.length;

  const renderPerson = (p: Person, subtitle: string, highlight = false) => (
    <View key={p._id} style={[styles.card, highlight && styles.cardHighlight]}>
      <View style={[styles.avatar, highlight && styles.avatarHighlight]}>
        {p.profile_photo ? (
          <Image source={{ uri: p.profile_photo }} style={styles.avatarImg} />
        ) : (
          <Ionicons name="person" size={22} color={highlight ? '#fff' : '#b68a2e'} />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.position} numberOfLines={1}>{p.position}</Text>
        <View style={styles.dateRow}>
          <Ionicons name="gift-outline" size={13} color={highlight ? '#b68a2e' : '#6b7280'} />
          <Text style={[styles.dateText, highlight && styles.dateTextHighlight]}>{subtitle}</Text>
        </View>
      </View>
      {highlight && <Ionicons name="star" size={20} color="#b68a2e" />}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color="#122c2a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Cumpleaños</Text>
          <Text style={styles.subtitle}>
            {totalCount} {totalCount === 1 ? 'próximo cumpleaños' : 'próximos cumpleaños'}
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
          {today.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>🎉 Hoy</Text>
              {today.map((p) => renderPerson(p, `Hoy, ${formatBirthday(p.birthdate)}`, true))}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, today.length > 0 && { marginTop: 20 }]}>
                Próximos (30 días)
              </Text>
              {upcoming.map((p) =>
                renderPerson(
                  p,
                  `${formatBirthday(p.birthdate)} · en ${p.days_until} ${p.days_until === 1 ? 'día' : 'días'}`,
                )
              )}
            </>
          )}

          {totalCount === 0 && (
            <View style={styles.empty}>
              <Ionicons name="gift-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>Sin cumpleaños en los próximos 30 días</Text>
            </View>
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  cardHighlight: {
    borderWidth: 1,
    borderColor: 'rgba(182,138,46,0.35)',
    backgroundColor: '#fffbeb',
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
  avatarHighlight: {
    backgroundColor: '#b68a2e',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  cardBody: { flex: 1 },
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
    marginBottom: 6,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  dateTextHighlight: {
    color: '#b68a2e',
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
