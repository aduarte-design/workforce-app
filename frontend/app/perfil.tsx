import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/contexts/AuthContext';
import { getUser, updateProfilePhoto, getUserKudos } from '@/src/utils/api';
import { storage } from '@/src/utils/storage';

const CATEGORY_INFO: any = {
  teamwork: { label: 'Trabajo en Equipo', color: '#3b82f6' },
  innovation: { label: 'Innovación', color: '#8b5cf6' },
  leadership: { label: 'Liderazgo', color: '#b68a2e' },
  excellence: { label: 'Excelencia', color: '#f59e0b' },
  helpful: { label: 'Colaborador', color: '#10b981' },
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<any>(null);
  const [receivedKudos, setReceivedKudos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const [profileData, kudosData] = await Promise.all([
        getUser(user._id),
        getUserKudos(user._id),
      ]);
      setProfile(profileData);
      setReceivedKudos(kudosData);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita permiso para acceder a las fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const photoBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      
      setIsUploading(true);
      try {
        await updateProfilePhoto(user!._id, photoBase64);
        // Update local user
        const updatedUser = { ...user!, profile_photo: photoBase64 };
        await storage.setItem('user', updatedUser);
        setProfile({ ...profile, profile_photo: photoBase64 });
        Alert.alert('Éxito', 'Foto de perfil actualizada');
      } catch (error) {
        Alert.alert('Error', 'No se pudo actualizar la foto');
      } finally {
        setIsUploading(false);
      }
    }
  };

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

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#122c2a" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#122c2a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={isUploading}>
            <View style={styles.avatar}>
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : profile.profile_photo ? (
                <Image source={{ uri: profile.profile_photo }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={60} color="#122c2a" />
              )}
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name}</Text>
            {profile.is_employee_of_month && (
              <Ionicons name="star" size={20} color="#b68a2e" />
            )}
          </View>
          <Text style={styles.position}>{profile.position}</Text>
          {profile.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#122c2a" />
              <Text style={styles.adminText}>Administrador</Text>
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Correo</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
          </View>

          {profile.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{profile.phone}</Text>
              </View>
            </View>
          )}

          {profile.birthdate && (
            <View style={styles.infoRow}>
              <Ionicons name="gift-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Cumpleaños</Text>
                <Text style={styles.infoValue}>{profile.birthdate}</Text>
              </View>
            </View>
          )}

          {profile.hire_date && (
            <View style={styles.infoRow}>
              <Ionicons name="briefcase-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha de Ingreso</Text>
                <Text style={styles.infoValue}>{profile.hire_date}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Kudos Received */}
        <View style={styles.card}>
          <View style={styles.kudosCardHeader}>
            <Ionicons name="heart" size={20} color="#ef4444" />
            <Text style={styles.cardTitle}>Kudos Recibidos ({receivedKudos.length})</Text>
          </View>

          {receivedKudos.length === 0 ? (
            <Text style={styles.emptyText}>Aún no has recibido kudos</Text>
          ) : (
            receivedKudos.slice(0, 5).map((kudo) => {
              const cat = CATEGORY_INFO[kudo.category] || CATEGORY_INFO.teamwork;
              return (
                <View key={kudo._id} style={styles.kudoItem}>
                  <View style={[styles.kudoBadge, { backgroundColor: cat.color }]}>
                    <Text style={styles.kudoBadgeText}>{cat.label}</Text>
                  </View>
                  <Text style={styles.kudoFrom}>De: {kudo.from_user_name}</Text>
                  <Text style={styles.kudoMessage}>&quot;{kudo.message}&quot;</Text>
                </View>
              );
            })
          )}
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
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#b68a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#122c2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#122c2a',
  },
  position: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    marginTop: 4,
  },
  adminText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#122c2a',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#122c2a',
    marginBottom: 12,
  },
  kudosCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#122c2a',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
  kudoItem: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  kudoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 6,
  },
  kudoBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  kudoFrom: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  kudoMessage: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
