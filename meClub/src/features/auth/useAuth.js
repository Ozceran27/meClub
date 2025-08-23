import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from '../../lib/api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const TOKEN_KEY = 'meclub_token';
const USER_KEY  = 'meclub_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user,  setUser]  = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión
  useEffect(() => {
    (async () => {
      try {
        const t = await SecureStore.getItemAsync(TOKEN_KEY);
        const u = await SecureStore.getItemAsync(USER_KEY);
        if (t) setToken(t);
        if (u) setUser(JSON.parse(u));
      } catch {}
      setLoading(false);
    })();
  }, []);

  // Header auth
  useEffect(() => {
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete api.defaults.headers.common.Authorization;
  }, [token]);

  const login = async ({ email, password }) => {
    const { data } = await api.post('/auth/login', { email, password });
    const t = data?.token;
    const u = data?.user;
    if (!t || !u) throw new Error('Respuesta de login inválida');

    setToken(t);
    setUser(u);
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(u));
    return u;
  };

  const logout = async () => {
    try {
      setToken(null);
      setUser(null);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } finally {
      // Redirección robusta en Web (evita quedarse en /dashboard)
      if (Platform.OS === 'web') window.location.assign('/login');
    }
  };

  const value = useMemo(() => ({
    token, user, loading, login, logout,
    isLogged: !!token,
    // soporto user.rol o user.role (según backend)
    isClub: !!user && (user.rol === 'club' || user.role === 'club'),
  }), [token, user, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
