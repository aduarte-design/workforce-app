import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#122c2a';
const GOLD = '#b68a2e';
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export type RankingEntry = {
  rank: number;
  user_id: string;
  name: string;
  position?: string;
  profile_photo?: string | null;
  count: number;
};

type Props = {
  month: Date; // first day of month
  onChangeMonth: (d: Date) => void;
  ranking: RankingEntry[];
  totalLikes: number;
  loading?: boolean;
  compact?: boolean; // only podium
  onSeeAll?: () => void;
};

const shiftMonth = (d: Date, delta: number) => new Date(d.getFullYear(), d.getMonth() + delta, 1);

function Avatar({ uri, size, ring }: { uri?: string | null; size: number; ring: string }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: ring }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size - 6, height: size - 6, borderRadius: (size - 6) / 2 }} />
      ) : (
        <Ionicons name="person" size={size * 0.45} color={GREEN} />
      )}
    </View>
  );
}

const PODIUM = [
  { idx: 1, height: 70, ring: '#c0c4cc', icon: 'medal', iconColor: '#9ca3af', size: 58 },
  { idx: 0, height: 96, ring: GOLD, icon: 'trophy', iconColor: GOLD, size: 72 },
  { idx: 2, height: 54, ring: '#d08a5c', icon: 'medal', iconColor: '#c2410c', size: 58 },
] as const;

export default function LikesRanking({ month, onChangeMonth, ranking, totalLikes, loading, compact, onSeeAll }: Props) {
  const now = new Date();
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  return (
    <View style={styles.card} testID="likes-ranking">
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Ranking del mes</Text>
          <Text style={styles.subtitle}>{totalLikes} likes entregados</Text>
        </View>
        <View style={styles.monthPicker}>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() => onChangeMonth(shiftMonth(month, -1))}
            testID="ranking-prev-month"
          >
            <Ionicons name="chevron-back" size={18} color={GOLD} />
          </TouchableOpacity>
          <Text style={styles.monthText} testID="ranking-month-label">
            {MONTHS[month.getMonth()].slice(0, 3)} {month.getFullYear()}
          </Text>
          <TouchableOpacity
            style={[styles.monthBtn, isCurrent && { opacity: 0.3 }]}
            onPress={() => !isCurrent && onChangeMonth(shiftMonth(month, 1))}
            disabled={isCurrent}
            testID="ranking-next-month"
          >
            <Ionicons name="chevron-forward" size={18} color={GOLD} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={GOLD} style={{ paddingVertical: 40 }} />
      ) : ranking.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trophy-outline" size={40} color="rgba(255,255,255,0.4)" />
          <Text style={styles.emptyText}>Aún no hay likes en {MONTHS[month.getMonth()].toLowerCase()}</Text>
        </View>
      ) : (
        <View style={styles.podiumRow}>
          {PODIUM.map((p) => {
            const e = ranking[p.idx];
            return (
              <View key={p.idx} style={styles.podiumCol} testID={`podium-${p.idx + 1}`}>
                {e ? (
                  <>
                    <Ionicons name={p.icon as any} size={20} color={p.iconColor} style={{ marginBottom: 4 }} />
                    <Avatar uri={e.profile_photo} size={p.size} ring={p.ring} />
                    <Text style={styles.podiumName} numberOfLines={1}>{e.name.split(' ')[0]}</Text>
                    <View style={styles.likesPill}>
                      <Ionicons name="heart" size={11} color="#ef4444" />
                      <Text style={styles.likesPillText}>{e.count}</Text>
                    </View>
                  </>
                ) : (
                  <View style={{ height: p.size + 60 }} />
                )}
                <View style={[styles.podiumBase, { height: p.height }, p.idx === 0 && { backgroundColor: GOLD }]}>
                  <Text style={[styles.podiumRank, p.idx === 0 && { color: GREEN }]}>{p.idx + 1}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {!compact && !loading && ranking.length > 3 && (
        <View style={styles.list}>
          {ranking.slice(3).map((e) => (
            <View key={e.user_id} style={styles.listRow} testID={`ranking-row-${e.rank}`}>
              <Text style={styles.listRank}>{e.rank}</Text>
              <Avatar uri={e.profile_photo} size={40} ring="rgba(255,255,255,0.15)" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.listName} numberOfLines={1}>{e.name}</Text>
                {!!e.position && <Text style={styles.listPos} numberOfLines={1}>{e.position}</Text>}
              </View>
              <View style={styles.likesPill}>
                <Ionicons name="heart" size={12} color="#ef4444" />
                <Text style={styles.likesPillText}>{e.count}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {compact && onSeeAll && ranking.length > 0 && (
        <TouchableOpacity style={styles.seeAll} onPress={onSeeAll} testID="ranking-see-all">
          <Text style={styles.seeAllText}>Ver Top 10</Text>
          <Ionicons name="arrow-forward" size={14} color={GOLD} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: GREEN, borderRadius: 24, padding: 18, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  kicker: { color: GOLD, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  monthPicker: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999, paddingHorizontal: 4,
  },
  monthBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  monthText: { color: '#fff', fontSize: 13, fontWeight: '700', minWidth: 72, textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  podiumCol: { flex: 1, alignItems: 'center', maxWidth: 140 },
  avatar: { backgroundColor: '#f5f5f7', borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  podiumName: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 6, maxWidth: '100%' },
  likesPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 4,
  },
  likesPillText: { color: GREEN, fontSize: 12, fontWeight: '800' },
  podiumBase: {
    width: '100%', marginTop: 8, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 8,
  },
  podiumRank: { color: '#fff', fontSize: 22, fontWeight: '900' },
  list: { marginTop: 16, gap: 8 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 10,
  },
  listRank: { color: GOLD, fontSize: 16, fontWeight: '900', width: 26, textAlign: 'center' },
  listName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  listPos: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  seeAll: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, marginTop: 14, padding: 6 },
  seeAllText: { color: GOLD, fontSize: 13, fontWeight: '800' },
});
