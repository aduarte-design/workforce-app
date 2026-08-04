import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { storage } from '@/src/utils/storage';

WebBrowser.maybeCompleteAuthSession();

interface User {
  _id: string;
  email: string;
  name: string;
  role: string;
  position?: string;
  profile_photo?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Track processed session_ids to avoid double-processing
const processedSessionIds = new Set<string>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      // Check for session_id in URL (from Google Auth redirect)
      if (Platform.OS === 'web') {
        const url = window.location.href;
        const sessionIdMatch = url.match(/[?#&]session_id=([^&#]+)/);
        if (sessionIdMatch && !processedSessionIds.has(sessionIdMatch[1])) {
          processedSessionIds.add(sessionIdMatch[1]);
          await exchangeSessionId(sessionIdMatch[1]);
          // Clean URL
          window.history.replaceState(window.history.state, '', window.location.pathname);
          setIsLoading(false);
          return;
        }
      } else {
        // Mobile: check initial URL
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const sessionIdMatch = initialUrl.match(/[?#&]session_id=([^&#]+)/);
          if (sessionIdMatch && !processedSessionIds.has(sessionIdMatch[1])) {
            processedSessionIds.add(sessionIdMatch[1]);
            await exchangeSessionId(sessionIdMatch[1]);
            setIsLoading(false);
            return;
          }
        }
      }

      // Load stored auth
      const storedToken = await storage.secureGet('auth_token', null);
      const storedUser = await storage.getItem('user', null);
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exchangeSessionId = async (sessionId: string) => {
    const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
    const response = await fetch(`${API_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Google login failed');
    }

    const data = await response.json();
    await storage.secureSet('auth_token', data.token);
    await storage.setItem('user', data.user);
    setToken(data.token);
    setUser(data.user);
  };

  const login = async (email: string, password: string) => {
    const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    await storage.secureSet('auth_token', data.token);
    await storage.setItem('user', data.user);
    setToken(data.token);
    setUser(data.user);
  };

  const loginWithGoogle = async () => {
    const redirectUrl =
      Platform.OS === 'web'
        ? window.location.origin + '/'
        : Linking.createURL('');
    
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === 'web') {
      window.location.href = authUrl;
      return;
    }

    // Mobile flow
    let capturedUrl: string | null = null;
    const urlListener = Linking.addEventListener('url', (event) => {
      capturedUrl = event.url;
    });

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      let callbackUrl: string | null = null;

      if (result.type === 'success' && (result as any).url) {
        callbackUrl = (result as any).url;
      } else if (capturedUrl) {
        callbackUrl = capturedUrl;
      } else {
        const initial = await Linking.getInitialURL();
        if (initial) callbackUrl = initial;
      }

      if (!callbackUrl) {
        throw new Error('No se pudo completar la autenticación con Google');
      }

      const sessionIdMatch = callbackUrl.match(/[?#&]session_id=([^&#]+)/);
      if (!sessionIdMatch) {
        throw new Error('No se recibió session_id de Google');
      }

      const sessionId = sessionIdMatch[1];
      if (processedSessionIds.has(sessionId)) return;
      processedSessionIds.add(sessionId);

      await exchangeSessionId(sessionId);
    } finally {
      urlListener.remove();
    }
  };

  const register = async (userData: any) => {
    const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    const data = await response.json();
    await storage.secureSet('auth_token', data.token);
    await storage.setItem('user', data.user);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    await storage.secureRemove('auth_token');
    await storage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginWithGoogle,
        register,
        logout,
        isLoading,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
