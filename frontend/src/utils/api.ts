import axios from 'axios';
import { storage } from '@/src/utils/storage';

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
