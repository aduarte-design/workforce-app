import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export const MOOD_OPTIONS = [
  { emoji: '😊', label: 'Feliz' },
  { emoji: '💪', label: 'Motivada' },
  { emoji: '🧘', label: 'Tranquila' },
  { emoji: '🚀', label: 'Enfocada' },
  { emoji: '🤩', label: 'Entusiasmada' },
  { emoji: '🥰', label: 'Agradecida' },
  { emoji: '😴', label: 'Cansada' },
  { emoji: '😣', label: 'Estresada' },
  { emoji: '🤔', label: 'Pensativa' },
  { emoji: '😢', label: 'Triste' },
];

type Props = {
  value?: string | null;
  editable?: boolean;
  onSave: (newMood: string) => Promise<void> | void;
};

export default function MoodCard({ value, editable = true, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(value || '');
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    if (!editable) return;
    setDraft(value || '');
    setOpen(true);
  };

  const pickPreset = (option: { emoji: string; label: string }) => {
    setDraft(`${option.emoji} ${option.label}`);
  };

  const handleSave = async () => {
    const final = draft.trim();
    setSaving(true);
    try {
      await onSave(final);
      setOpen(false);
    } catch (e) {
      // Error handled by caller
    } finally {
      setSaving(false);
    }
  };

  const displayText = value && value.trim().length > 0 ? value : 'Toca para elegir cómo te sientes';

  return (
    <>
      <TouchableOpacity
        activeOpacity={editable ? 0.85 : 1}
        onPress={openModal}
        style={styles.container}
        testID="mood-card"
      >
        <LinearGradient
          colors={['#d4c04a', '#64b9a8', '#eb7fab', '#eb9566', '#d4c04a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Watercolor-ish second layer for extra depth */}
          <LinearGradient
            colors={[
              'rgba(255,255,255,0.08)',
              'rgba(255,255,255,0)',
              'rgba(0,0,0,0.08)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.content}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Hoy te sientes...</Text>
              {editable && (
                <View style={styles.editBadge}>
                  <Ionicons name="pencil" size={12} color="#fff" />
                </View>
              )}
            </View>
            <Text
              style={[styles.mood, !value && styles.moodPlaceholder]}
              numberOfLines={2}
            >
              {displayText}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>¿Cómo te sientes hoy?</Text>
            <Text style={styles.sheetHint}>
              Toca una opción o escribe la tuya.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {MOOD_OPTIONS.map((opt) => {
                const key = `${opt.emoji} ${opt.label}`;
                const active = draft === key;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => pickPreset(opt)}
                    testID={`mood-chip-${opt.label}`}
                  >
                    <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.inputLabel}>Mi estado de ánimo</Text>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Ej: 🚀 Enfocada en cerrar el trimestre"
              placeholderTextColor="#9ca3af"
              maxLength={80}
              testID="mood-input"
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setOpen(false)}
                disabled={saving}
              >
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                testID="mood-save-btn"
              >
                {saving ? (
                  <ActivityIndicator color="#b68a2e" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 6px 16px rgba(0,0,0,0.12)' } as any,
    }),
  },
  gradient: {
    minHeight: 110,
    padding: 20,
    justifyContent: 'center',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  editBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  mood: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  moodPlaceholder: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#122c2a',
    letterSpacing: -0.4,
  },
  sheetHint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 14,
  },
  chipsRow: {
    gap: 8,
    paddingRight: 20,
    paddingBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#fff',
    borderColor: '#b68a2e',
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  chipLabelActive: {
    color: '#122c2a',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#122c2a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#122c2a',
    backgroundColor: '#f9fafb',
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: '#f3f4f6',
  },
  btnGhostText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: '#122c2a',
  },
  btnPrimaryText: {
    color: '#b68a2e',
    fontSize: 14,
    fontWeight: '800',
  },
});
