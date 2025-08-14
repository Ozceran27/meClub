import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';

const AuthCtx = createContext(null);

// Fallback para web si SecureStore no está disponible
const storage = {
  getItem: async (k) => (await SecureStore.getItemAsync(k)) ?? (await AsyncStorage.getItem(k)),
  setItem: async (k, v) => {
    try { await SecureStore.setItemAsync(k, v); } catch {}
    await AsyncStorage.setItem(k, v);
  },
  delItem: async (k) => {
    try { await SecureStore.deleteItemAsync(k); } catch {}
    await AsyncStorage.removeItem(k);
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await storage.getItem('mc_token');
      const u = await storage.getItem('mc_user');
      if (token && u) setUser(JSON.parse(u));
      setReady(true);
    })();
  }, []);

  const value = useMemo(() => ({
    ready,
    user,
    login: async ({ email, password }) => {
      const { data } = await api.post('/auth/login', { email, contrasena: password });
      const { token, usuario } = data;
      await storage.setItem('mc_token', token);
      await storage.setItem('mc_user', JSON.stringify(usuario));
      setUser(usuario);
      return usuario;
    },
    logout: async () => {
      await storage.delItem('mc_token');
      await storage.delItem('mc_user');
      setUser(null);
    },
  }), [ready, user]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);