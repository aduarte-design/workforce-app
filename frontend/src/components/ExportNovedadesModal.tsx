import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { downloadNovedades } from '@/src/utils/api';
import { showAlert } from '@/src/utils/alert';

const GREEN = '#122c2a';
const GOLD = '#b68a2e';

const TYPES = [
  { key: '', label: 'Todos' },
  { key: 'vacation', label: 'Vacaciones' },
  { key: 'medical', label: 'Cita médica' },
  { key: 'normal', label: 'Permiso' },
  { key: 'telework', label: 'Teletrabajo' },
];
const STATUSES = [
  { key: '', label: 'Todos' },
  { key: 'pending', label: 'Pendiente' },
  { key: 'approved', label: 'Aprobada' },
  { key: 'rejected', label: 'Rechazada' },
];
const RANGES = [
  { key: 'all', label: 'Todo' },
  { key: 'month', label: 'Este mes' },
  { key: '3m', label: 'Últimos 3 meses' },
  { key: 'year', label: 'Este año' },
  { key: 'custom', label: 'Personalizado' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeDates(key: RangeKey, from: Date, to: Date): { start?: string; end?: string } {
  const now = new Date();
  switch (key) {
    case 'month':
      return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case '3m':
      return { start: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), end: iso(now) };
    case 'year':
      return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
    case 'custom':
      return { start: iso(from), end: iso(to) };
    default:
      return {};
  }
}

function Chips<T extends string>({
  options, value, onChange, prefix,
}: { options: readonly { key: T; label: string }[]; value: T; onChange: (v: T) => void; prefix: string }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key || 'all'}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(o.key)}
            testID={`${prefix}-${o.key || 'all'}`}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DateField({ label, value, onChange, testID }: { label: string; value: Date; onChange: (d: Date) => void; testID: string }) {
  const [show, setShow] = useState(false);
  const [text, setText] = useState(iso(value));
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1 }}>
        <Text style={styles.smallLabel}>{label}</Text>
        <TextInput
          style={styles.dateInput}
          value={text}
          placeholder="AAAA-MM-DD"
          onChangeText={(t) => {
            setText(t);
            const d = new Date(`${t}T12:00:00`);
            if (/^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(d.getTime())) onChange(d);
          }}
          testID={testID}
        />
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TouchableOpacity style={styles.dateInput} onPress={() => setShow(true)} testID={testID}>
        <Ionicons name="calendar-outline" size={16} color={GREEN} />
        <Text style={styles.dateText}>{iso(value)}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_e, d) => {
            setShow(Platform.OS === 'ios');
            if (d) onChange(d);
          }}
        />
      )}
    </View>
  );
}

export default function ExportNovedadesModal({ visible, onClose, isAdmin }: { visible: boolean; onClose: () => void; isAdmin: boolean }) {
  const [range, setRange] = useState<RangeKey>('all');
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), 0, 1));
  const [to, setTo] = useState(() => new Date());
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<'' | 'xlsx' | 'pdf'>('');

  const handleDownload = async (format: 'xlsx' | 'pdf') => {
    const dates = rangeDates(range, from, to);
    if (dates.start && dates.end && dates.start > dates.end) {
      showAlert('Fechas inválidas', 'La fecha inicial debe ser anterior a la final.');
      return;
    }
    setBusy(format);
    try {
      await downloadNovedades({ format, ...dates, type: type || undefined, status: status || undefined });
      onClose();
    } catch (e: any) {
      showAlert('Error', e?.message || 'No se pudo descargar el histórico');
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet} testID="export-modal">
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Descargar histórico</Text>
              <Text style={styles.subtitle}>
                {isAdmin ? 'Novedades de todo el equipo' : 'Tus novedades'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="export-close-btn">
              <Ionicons name="close" size={20} color={GREEN} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Rango de fechas</Text>
            <Chips options={RANGES} value={range} onChange={setRange} prefix="export-range" />
            {range === 'custom' && (
              <View style={styles.dateRow}>
                <DateField label="Desde" value={from} onChange={setFrom} testID="export-from" />
                <DateField label="Hasta" value={to} onChange={setTo} testID="export-to" />
              </View>
            )}

            <Text style={styles.label}>Tipo</Text>
            <Chips options={TYPES} value={type} onChange={setType} prefix="export-type" />

            <Text style={styles.label}>Estado</Text>
            <Chips options={STATUSES} value={status} onChange={setStatus} prefix="export-status" />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.dlBtn, { backgroundColor: '#15803d' }, !!busy && styles.disabled]}
                onPress={() => handleDownload('xlsx')}
                disabled={!!busy}
                testID="export-xlsx-btn"
              >
                {busy === 'xlsx' ? <ActivityIndicator color="#fff" /> : <Ionicons name="grid-outline" size={18} color="#fff" />}
                <Text style={styles.dlText}>Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dlBtn, { backgroundColor: GREEN }, !!busy && styles.disabled]}
                onPress={() => handleDownload('pdf')}
                disabled={!!busy}
                testID="export-pdf-btn"
              >
                {busy === 'pdf' ? <ActivityIndicator color="#fff" /> : <Ionicons name="document-text-outline" size={18} color={GOLD} />}
                <Text style={styles.dlText}>PDF</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36, maxHeight: '90%', width: '100%', maxWidth: 640, alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: GREEN, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f7', justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '800', color: GREEN, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  smallLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#f5f5f7', minHeight: 40, justifyContent: 'center' },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 13, color: GREEN, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  dateRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dateInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 12, minHeight: 44, color: GREEN, fontSize: 14,
  },
  dateText: { fontSize: 14, color: GREEN, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  dlBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 999 },
  dlText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
