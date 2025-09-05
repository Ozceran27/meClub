// src/features/auth/useAuth.js
import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from '../../lib/api';
import { tokenKey, getItem, setItem, delItem } from '../../lib/storage';

const AuthCtx = createContext(null);
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};

const userKey  = 'mc_user';

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [ready, setReady] = useState(false);

  // hidratar sesión
  useEffect(() => {
    (async () => {
      try {
        const t = await getItem(tokenKey);
        const u = await getItem(userKey);
        if (t && u) setUser(JSON.parse(u));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = async ({ email, password }) => {
    // Tu backend espera { email, contrasena }
    const data = await api.post('/auth/login', { email, contrasena: password }, { auth: false });
    // Respuesta esperada: { token, usuario, club? }
    const { token, usuario, club } = data || {};
    if (!token || !usuario) throw new Error('Respuesta de login inválida');
    // Enriquecemos el usuario con info del club si aplica
    const userData = {
      ...usuario,
      ...(club ? { clubId: club.club_id, clubNombre: club.nombre } : {}),
    };

    await setItem(tokenKey, token);
    await setItem(userKey, JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (params) => {
    const data = await api.post('/auth/register', params);
    // Algunas versiones del backend pueden devolver `user` en lugar de `usuario`
    const { token, usuario, user } = data || {};
    const usr = usuario || user;
    if (!token || !usr) throw new Error('Respuesta de registro inválida');

    await setItem(tokenKey, token);
    await setItem(userKey, JSON.stringify(usr));
    setUser(usr);
    return usr;
  };


  const logout = async () => {
    await delItem(tokenKey);
    await delItem(userKey);
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
