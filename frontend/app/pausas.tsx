import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getPausasActivas } from '@/src/utils/api';
import {
  schedulePausaActivaNotifications,
  getScheduledPausasNotifications,
} from '@/src/utils/pausaNotifications';

type Pausa = {
  _id: string;
  order: number;
  name: string;
  description: string;
  focus_area: string;
  duration_seconds: number;
  instructions: string[];
  image_base64: string | null;
};

const formatDuration = (s: number) => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m}m ${r}s`;
};

export default function PausasActivasScreen() {
  const router = useRouter();
  const [pausas, setPausas] = useState<Pausa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Pausa | null>(null);
  const [notifStatus, setNotifStatus] = useState<'checking' | 'active' | 'inactive'>('checking');

  const load = useCallback(async () => {
    try {
      const data = await getPausasActivas();
      setPausas(data || []);
    } catch (e) {
      console.error('Error loading pausas:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        setNotifStatus('inactive');
        return;
      }
      const scheduled = await getScheduledPausasNotifications();
      setNotifStatus(scheduled.length >= 2 ? 'active' : 'inactive');
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const activateNotifications = async () => {
    const res = await schedulePausaActivaNotifications();
    if (res.scheduled) {
      setNotifStatus('active');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color="#122c2a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pausas Activas</Text>
          <Text style={styles.subtitle}>10 ejercicios · 2 recordatorios al día</Text>
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
          {/* Reminder banner */}
          <View style={styles.reminderCard}>
            <View style={styles.reminderIconBox}>
              <Ionicons name="alarm" size={20} color="#b68a2e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>Recordatorios diarios</Text>
              <Text style={styles.reminderText}>
                Te avisaremos a las 11:00 AM y 4:00 PM (hora Colombia) para hacer tu pausa activa.
              </Text>
              {notifStatus === 'active' && (
                <View style={styles.notifBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={styles.notifBadgeText}>Activos</Text>
                </View>
              )}
              {notifStatus === 'inactive' && Platform.OS !== 'web' && (
                <TouchableOpacity style={styles.activateBtn} onPress={activateNotifications}>
                  <Ionicons name="notifications" size={14} color="#fff" />
                  <Text style={styles.activateBtnText}>Activar recordatorios</Text>
                </TouchableOpacity>
              )}
              {Platform.OS === 'web' && (
                <Text style={styles.webNote}>
                  * En navegador se muestra la sección; las notificaciones funcionan en la app
                  instalada.
                </Text>
              )}
            </View>
          </View>

          {/* Cards */}
          {pausas.map((p) => (
            <TouchableOpacity
              key={p._id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => setSelected(p)}
              testID={`pausa-${p.order}`}
            >
              <View style={styles.imageWrap}>
                {p.image_base64 ? (
                  <Image
                    source={{ uri: p.image_base64 }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.image, styles.imageFallback]}>
                    <Ionicons name="body" size={32} color="#b68a2e" />
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderNum}>{String(p.order).padStart(2, '0')}</Text>
                  <View style={styles.durationChip}>
                    <Ionicons name="time-outline" size={12} color="#122c2a" />
                    <Text style={styles.durationText}>{formatDuration(p.duration_seconds)}</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle}>{p.name}</Text>
                <Text style={styles.cardFocus}>{p.focus_area}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {p.description}
                </Text>
                <View style={styles.viewMore}>
                  <Text style={styles.viewMoreText}>Ver instrucciones</Text>
                  <Ionicons name="arrow-forward" size={14} color="#b68a2e" />
                </View>
              </View>
            </TouchableOpacity>
          ))}

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {selected && (
                <>
                  <View style={styles.modalImageWrap}>
                    {selected.image_base64 ? (
                      <Image
                        source={{ uri: selected.image_base64 }}
                        style={styles.modalImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.modalImage, styles.imageFallback]}>
                        <Ionicons name="body" size={48} color="#b68a2e" />
                      </View>
                    )}
                  </View>
                  <View style={styles.modalContent}>
                    <View style={styles.modalTagsRow}>
                      <View style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{selected.focus_area}</Text>
                      </View>
                      <View style={styles.tagChip}>
                        <Ionicons name="time-outline" size={12} color="#122c2a" />
                        <Text style={styles.tagChipText}>
                          {formatDuration(selected.duration_seconds)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.modalTitle}>{selected.name}</Text>
                    <Text style={styles.modalDesc}>{selected.description}</Text>
                    <Text style={styles.stepsHeader}>Cómo hacerla</Text>
                    {selected.instructions.map((step, i) => (
                      <View key={i} style={styles.stepRow}>
                        <View style={styles.stepBullet}>
                          <Text style={styles.stepBulletText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.closeBtn}
                      onPress={() => setSelected(null)}
                    >
                      <Text style={styles.closeBtnText}>Cerrar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  reminderCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  reminderIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#122c2a',
    marginBottom: 2,
  },
  reminderText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
  },
  notifBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  notifBadgeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#122c2a',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  activateBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  webNote: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  imageWrap: {
    backgroundColor: '#f5f5f7',
  },
  image: {
    width: '100%',
    height: 180,
  },
  imageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  cardBody: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b68a2e',
    letterSpacing: 1,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#122c2a',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -0.3,
  },
  cardFocus: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  viewMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  viewMoreText: {
    fontSize: 12,
    color: '#b68a2e',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  modalImageWrap: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f5f5f7',
  },
  modalImage: {
    width: '100%',
    height: 240,
  },
  modalContent: {
    padding: 20,
  },
  modalTagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#122c2a',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  stepsHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#122c2a',
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  stepBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#122c2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  stepBulletText: {
    color: '#b68a2e',
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },
  closeBtn: {
    marginTop: 20,
    backgroundColor: '#122c2a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
