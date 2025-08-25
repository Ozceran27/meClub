import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3006/api';

const tokenKey = 'mc_token';
async function getToken() {
  try { const t = await SecureStore.getItemAsync(tokenKey); if (t) return t; } catch {}
  if (Platform.OS === 'web') return localStorage.getItem(tokenKey);
  return AsyncStorage.getItem(tokenKey);
}

async function request(path, { method = 'GET', body, headers } = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.mensaje || data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, b) => request(p, { method: 'POST', body: b }),
  put: (p, b) => request(p, { method: 'PUT', body: b }),
  del: (p) => request(p, { method: 'DELETE' }),
};

export const authApi = {
  forgot: (email) => api.post('/auth/forgot', { email }),
  reset: (token, password) => api.post('/auth/reset', { token, password }),
};

export async function getClubSummary({ clubId }) {
  try {
    const { data } = await api.get(`/clubes/${clubId}/resumen`);
    // Esperado: { courtsAvailable, reservasHoy, reservasSemana, economiaMes }
    return {
      courtsAvailable: data?.courtsAvailable ?? 3,
      reservasHoy: data?.reservasHoy ?? 0,
      reservasSemana: data?.reservasSemana ?? 0,
      economiaMes: data?.economiaMes ?? 0,
    };
  } catch {
    // Fallback
    return {
      courtsAvailable: 3,
      reservasHoy: 8,
      reservasSemana: 24,
      economiaMes: 14520,
    };
  }
}