import { tokenKey, getItem } from './storage';

const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3006/api';

async function request(path, { method = 'GET', body, headers, auth = true } = {}) {
  const token = auth ? await getItem(tokenKey) : null;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Network unavailable');
  }
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
  get: (p, opts) => request(p, opts),
  post: (p, b, opts) => request(p, { method: 'POST', body: b, ...(opts || {}) }),
  put: (p, b, opts) => request(p, { method: 'PUT', body: b, ...(opts || {}) }),
  patch: (p, b, opts) => request(p, { method: 'PATCH', body: b, ...(opts || {}) }),
  del: (p, opts) => request(p, { method: 'DELETE', ...(opts || {}) }),
};

export const authApi = {
  forgot: (email) => api.post('/auth/forgot', { email }),
  reset: (token, password) => api.post('/auth/reset', { token, password }),
};

function extractClub(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const club = payload.club ?? payload.data ?? payload;
  return club && typeof club === 'object' ? club : {};
}

function extractProvinces(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const provinces = payload.provincias ?? payload.data ?? payload;
  return Array.isArray(provinces) ? provinces : [];
}

export async function getClubProfile() {
  const response = await api.get('/clubes/mis-datos');
  return extractClub(response);
}

export async function updateClubProfile(payload) {
  const response = await api.patch('/clubes/mis-datos', payload);
  return extractClub(response);
}

export async function listProvinces() {
  const response = await api.get('/provincias');
  return extractProvinces(response);
}

export async function getClubSummary({ clubId }) {
  if (clubId === undefined) {
    return { courtsAvailable: 0, reservasHoy: 0, reservasSemana: 0, economiaMes: 0 };
  }
  try {
    const { data } = await api.get(`/clubes/${clubId}/resumen`);
    if (!data) {
      // Backend no respondió correctamente
      return { courtsAvailable: 0, reservasHoy: 0, reservasSemana: 0, economiaMes: 0 };
    }
    // Esperado: { courtsAvailable, reservasHoy, reservasSemana, economiaMes }
    return {
      courtsAvailable: data.courtsAvailable ?? 0,
      reservasHoy: data.reservasHoy ?? 0,
      reservasSemana: data.reservasSemana ?? 0,
      economiaMes: data.economiaMes ?? 0,
    };
  } catch (err) {
    console.warn('getClubSummary error', err);
    throw err;
  }
}
