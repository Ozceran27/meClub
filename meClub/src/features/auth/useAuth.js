// src/features/auth/useAuth.js
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { api, resolveAssetUrl } from '../../lib/api';
import { tokenKey, getItem, setItem, delItem } from '../../lib/storage';
import { navigationRef } from '../../navigation/navigationRef';

const AuthCtx = createContext(null);
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};

const userKey = 'mc_user';

const resolveNivelId = (club, usuario) => {
  const rawNivel = club?.nivel_id ?? club?.nivel ?? usuario?.nivel_id ?? usuario?.nivel;
  const parsed = Number(rawNivel);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const withDerivedUserFields = (data) => {
  if (!data) return data;
  const next = { ...data };
  next.nivel_id = resolveNivelId(next.club, next);
  if ('foto_logo' in next) {
    next.clubLogoUrl = resolveAssetUrl(next.foto_logo);
  } else if (next.clubLogoUrl && next.foto_logo == null) {
    next.clubLogoUrl = resolveAssetUrl(next.clubLogoUrl);
  }
  return next;
};

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [ready, setReady] = useState(false);

  // hidratar sesión
  useEffect(() => {
    (async () => {
      try {
        const t = await getItem(tokenKey);
        const u = await getItem(userKey);
        if (t && u) setUser(withDerivedUserFields(JSON.parse(u)));
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
    const userData = withDerivedUserFields({
      ...usuario,
      foto_logo: club?.foto_logo ?? usuario?.foto_logo ?? null,
      nivel_id: resolveNivelId(club, usuario),
      ...(club ? { clubId: club.club_id, clubNombre: club.nombre } : {}),
    });

    await setItem(tokenKey, token);
    await setItem(userKey, JSON.stringify(userData));
    setUser(userData);

    const destination = String(userData?.rol ?? userData?.role ?? '')
      .toLowerCase()
      .startsWith('club')
      ? 'Dashboard'
      : 'WorkInProgress';

    const ensureNavigation = () => {
      try {
        if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: destination }] });
        } else if (Platform.OS === 'web') {
          const webPath = destination === 'Dashboard' ? '/dashboard' : '/working';
          window.location.assign(webPath);
        } else {
          setTimeout(ensureNavigation, 50);
        }
      } catch {
        if (Platform.OS === 'web') {
          try {
            const webPath = destination === 'Dashboard' ? '/dashboard' : '/working';
            window.location.assign(webPath);
          } catch {}
        }
      }
    };

    ensureNavigation();
    return userData;
  };

  const register = async ({ nombre, apellido, email, password, rol, nombre_club, descripcion_club, foto_logo, nivel_id }) => {
    const payload = { nombre, apellido, email, contrasena: password, rol, nombre_club };
    if (descripcion_club) payload.descripcion_club = descripcion_club;
    if (foto_logo) payload.foto_logo = foto_logo;
    if (nivel_id) payload.nivel_id = nivel_id;
    const data = await api.post('/auth/register', payload, { auth: false });
    // Devolver solo el mensaje y asegurarse de cerrar cualquier sesión previa
    const { mensaje } = data || {};
    await logout();
    return mensaje;
  };


  const logout = async () => {
    await delItem(tokenKey);
    await delItem(userKey);
    setUser(null);
    try {
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
      } else if (Platform.OS === 'web') {
        window.location.assign('/login');
      }
    } catch {
      if (Platform.OS === 'web') {
        try { window.location.assign('/login'); } catch {}
      }
    }
  };
  const updateUser = useCallback(async (updates = {}) => {
    let nextUser = null;
    setUser((prev) => {
      const base = prev ? { ...prev } : {};
      nextUser = withDerivedUserFields({ ...base, ...(updates || {}) });
      return nextUser;
    });
    if (nextUser) {
      await setItem(userKey, JSON.stringify(nextUser));
    } else {
      await delItem(userKey);
    }
    return nextUser;
  }, []);

  const isClub = !!user && String(user.rol ?? user.role ?? '').toLowerCase().startsWith('club');
  const value = useMemo(() => ({
    user,
    ready,
    isLogged: !!user,
    isClub,
    login,
    register,
    logout,
    updateUser,
  }), [user, ready, isClub, login, register, logout, updateUser]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
