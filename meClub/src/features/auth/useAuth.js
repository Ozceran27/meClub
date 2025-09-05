// src/features/auth/useAuth.js
import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';

const AuthCtx = createContext(null);
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};

const tokenKey = 'mc_token';
const userKey  = 'mc_user';

// almacenamiento híbrido (SecureStore -> localStorage -> AsyncStorage)
const storage = {
  async getItem(k) {
    try { const v = await SecureStore.getItemAsync(k); if (v != null) return v; } catch {}
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(k);
      if (v != null) return v;
    }
    return AsyncStorage.getItem(k);
  },
  async setItem(k, v) {
    try { await SecureStore.setItemAsync(k, v); } catch {}
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(k, v);
    await AsyncStorage.setItem(k, v);
  },
  async delItem(k) {
    try { await SecureStore.deleteItemAsync(k); } catch {}
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.removeItem(k);
    await AsyncStorage.removeItem(k);
  },
};

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [ready, setReady] = useState(false);

  // hidratar sesión
  useEffect(() => {
    (async () => {
      try {
        const t = await storage.getItem(tokenKey);
        const u = await storage.getItem(userKey);
        if (t && u) setUser(JSON.parse(u));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = async ({ email, password }) => {
    // Tu backend espera { email, contrasena }
    const data = await api.post('/auth/login', { email, contrasena: password });
    // Respuesta esperada: { token, usuario, club? }
    const { token, usuario, club } = data || {};
    if (!token || !usuario) throw new Error('Respuesta de login inválida');

    // Enriquecemos el usuario con info del club si aplica
    const userData = {
      ...usuario,
      ...(club ? { clubId: club.club_id, clubNombre: club.nombre } : {}),
    };

    await storage.setItem(tokenKey, token);
    await storage.setItem(userKey, JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (params) => {
    const data = await api.post('/auth/register', params);
    // Algunas versiones del backend pueden devolver `user` en lugar de `usuario`
    const { token, usuario, user } = data || {};
    const usr = usuario || user;
    if (!token || !usr) throw new Error('Respuesta de registro inválida');

    await storage.setItem(tokenKey, token);
    await storage.setItem(userKey, JSON.stringify(usr));
    setUser(usr);
    return usr;
  };

  const logout = async () => {
    await storage.delItem(tokenKey);
    await storage.delItem(userKey);
    setUser(null);
    // Redirección robusta en Web: evita que el stack quede en /dashboard
    if (Platform.OS === 'web') {
      try { window.location.assign('/login'); } catch {}
    }
  };

  const isClub = !!user && String(user.rol ?? user.role ?? '').toLowerCase().startsWith('club');

  const value = useMemo(() => ({
    user,
    ready,
    isLogged: !!user,
    isClub,
    login,
    register,
    logout,
  }), [user, ready, isClub]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
