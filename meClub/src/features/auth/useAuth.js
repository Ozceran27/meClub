import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';

const AuthCtx = createContext(null);

const tokenKey = 'mc_token';
const userKey  = 'mc_user';

// Almacenamiento híbrido (SecureStore → localStorage → AsyncStorage)
const storage = {
  async getItem(k) {
    try { const v = await SecureStore.getItemAsync(k); if (v != null) return v; } catch {}
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(k);
      if (v != null) return v;
    }
    return AsyncStorage.getItem(k);
  },
  async setItem(k, v) {
    try { await SecureStore.setItemAsync(k, v); } catch {}
    if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
    await AsyncStorage.setItem(k, v);
  },
  async delItem(k) {
    try { await SecureStore.deleteItemAsync(k); } catch {}
    if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
    await AsyncStorage.removeItem(k);
  },
};

export function AuthProvider({ children, onReady }) {
  const [user,  setUser]  = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getItem(tokenKey);
        const u     = await storage.getItem(userKey);
        if (token && u) setUser(JSON.parse(u));
      } finally {
        setReady(true);
        onReady?.();
      }
    })();
  }, [onReady]);

  const loginFn = async ({ email, password }) => {
    setError('');
    const data = await api.post('/auth/login', { email, contrasena: password });
    const { token, usuario } = data;
    await storage.setItem(tokenKey, token);
    await storage.setItem(userKey,  JSON.stringify(usuario));
    setUser(usuario);
    return usuario;
  };

  const value = useMemo(() => ({
    ready,
    error,
    user,
    isLogged: !!user,

    login: loginFn,

    async register({ nombre, email, password, rol = 'deportista', nombre_club }) {
      setError('');
      await api.post('/auth/register', {
        nombre,
        email,
        contrasena: password,
        rol,
        ...(rol === 'club' && nombre_club ? { nombre_club } : {}),
      });
      return await loginFn({ email, password });
    },

    async logout() {
      await storage.delItem(tokenKey);
      await storage.delItem(userKey);
      setUser(null);
    },

    clearError() { setError(''); },
  }), [ready, user, error]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};
