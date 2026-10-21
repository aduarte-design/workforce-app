import axios from 'axios';
import { storage } from '@/src/utils/storage';
import { uploadForm } from '@/src/utils/upload';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await storage.secureGet('auth_token', null);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      storage.secureRemove('auth_token');
      storage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;

// API Functions

// Auth
export const loginUser = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const registerUser = async (userData: any) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

// Users
export const getUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};

export const getUser = async (userId: string) => {
  const response = await api.get(`/users/${userId}`);
  return response.data;
};

export const updateUser = async (userId: string, updates: any) => {
  const response = await api.put(`/users/${userId}`, updates);
  return response.data;
};

export const deleteUser = async (userId: string) => {
  const response = await api.delete(`/users/${userId}`);
  return response.data;
};

export const getUserPdfUrl = (userId: string) => `${API_URL}/api/users/${userId}/export-pdf`;

export const downloadUserPdf = async (userId: string, filename = 'empleado.pdf') => {
  const token = await storage.secureGet('auth_token', null);
  const resp = await fetch(getUserPdfUrl(userId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error('No se pudo generar el PDF');
  const blob = await resp.blob();
  // Web: trigger browser download
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
  }
  // Native fallback: just return the blob (caller should use expo-file-system)
  return { ok: true, blob };
};

export const requestPasswordReset = async (email: string) => {
  const response = await api.post('/auth/password-reset/request', { email });
  return response.data;
};

export const changePassword = async (newPassword: string) => {
  const response = await api.post('/auth/change-password', { new_password: newPassword });
  return response.data;
};

// Leave Requests
export const getLeaveRequests = async () => {
  const response = await api.get('/leave-requests');
  return response.data;
};

export const createLeaveRequest = async (requestData: any) => {
  const response = await api.post('/leave-requests', requestData);
  return response.data;
};

export const getLeaveRequest = async (requestId: string) => {
  const response = await api.get(`/leave-requests/${requestId}`);
  return response.data;
};

export const approveLeaveRequest = async (requestId: string, status: 'approved' | 'rejected') => {
  const response = await api.put(`/leave-requests/${requestId}/approve`, { status });
  return response.data;
};

// Dashboard
export const getAbsentEmployees = async () => {
  const response = await api.get('/dashboard/absent');
  return response.data;
};

export const getBirthdays = async () => {
  const response = await api.get('/dashboard/birthdays');
  return response.data;
};

export const getEmployeeOfMonth = async () => {
  const response = await api.get('/dashboard/employee-of-month');
  return response.data;
};

export const setEmployeeOfMonth = async (userId: string) => {
  const response = await api.put(`/dashboard/employee-of-month/${userId}`);
  return response.data;
};

// Events
export const getEvents = async () => {
  const response = await api.get('/events');
  return response.data;
};

export const createEvent = async (eventData: any) => {
  const response = await api.post('/events', eventData);
  return response.data;
};

export const updateEvent = async (eventId: string, eventData: any) => {
  const response = await api.put(`/events/${eventId}`, eventData);
  return response.data;
};

export const deleteEvent = async (eventId: string) => {
  const response = await api.delete(`/events/${eventId}`);
  return response.data;
};

// Goals
export const getGoals = async () => {
  const response = await api.get('/goals');
  return response.data;
};

export const updateGoal = async (goalId: string, goalData: any) => {
  const response = await api.put(`/goals/${goalId}`, goalData);
  return response.data;
};

// Capsules
export const getCapsules = async () => {
  const response = await api.get('/capsules');
  return response.data;
};

export const createCapsule = async (capsuleData: any) => {
  const response = await api.post('/capsules', capsuleData);
  return response.data;
};

export const updateCapsule = async (capsuleId: string, capsuleData: any) => {
  const response = await api.put(`/capsules/${capsuleId}`, capsuleData);
  return response.data;
};

export const deleteCapsule = async (capsuleId: string) => {
  const response = await api.delete(`/capsules/${capsuleId}`);
  return response.data;
};

// Notifications
export const getNotifications = async () => {
  const response = await api.get('/notifications');
  return response.data;
};

export const markNotificationRead = async (notificationId: string) => {
  const response = await api.put(`/notifications/${notificationId}/read`);
  return response.data;
};

// Kudos
export const getKudos = async () => {
  const response = await api.get('/kudos');
  return response.data;
};

export const createKudo = async (kudoData: any) => {
  const response = await api.post('/kudos', kudoData);
  return response.data;
};

export const getUserKudos = async (userId: string) => {
  const response = await api.get(`/kudos/user/${userId}`);
  return response.data;
};

export const getKudosRanking = async (month: string) => {
  const response = await api.get('/kudos/ranking', { params: { month } });
  return response.data;
};

// Files (Object Storage)
export const uploadProofFile = async (file: { uri: string; name: string; mimeType?: string | null }) => {
  const token = await storage.secureGet('auth_token', null);
  return uploadForm(`${API_URL}/api/upload`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    files: { file },
  });
};

export const getFileUrl = async (fileId: string) => {
  const token = await storage.secureGet('auth_token', null);
  return `${API_URL}/api/files/${fileId}?token=${encodeURIComponent(String(token || ''))}`;
};

export const getKudosLeaderboard = async () => {
  const response = await api.get('/kudos/leaderboard');
  return response.data;
};

// Reports
export const getStats = async () => {
  const response = await api.get('/reports/stats');
  return response.data;
};

// Profile Photo
export const updateProfilePhoto = async (userId: string, photoBase64: string) => {
  const response = await api.put(`/users/${userId}/photo`, {
    profile_photo: photoBase64,
  });
  return response.data;
};

// Seed
export const seedDatabase = async () => {
  const response = await api.post('/seed');
  return response.data;
};

// Pausas Activas
export const getPausasActivas = async () => {
  const response = await api.get('/pausas-activas');
  return response.data;
};

export const getRandomPausa = async () => {
  const response = await api.get('/pausas-activas/random');
  return response.data;
};
