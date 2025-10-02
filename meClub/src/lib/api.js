import { tokenKey, getItem } from './storage';

const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3006/api';

let API_ORIGIN = '';
try {
  const parsed = new URL(BASE);
  API_ORIGIN = parsed.origin;
} catch (err) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      const fallback = new URL(BASE, window.location.origin);
      API_ORIGIN = fallback.origin;
    } catch {
      API_ORIGIN = window.location.origin;
    }
  }
}

async function request(path, { method = 'GET', body, headers, auth = true } = {}) {
  const token = auth ? await getItem(tokenKey) : null;
  let res;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const baseHeaders = {
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers || {}),
  };

  if (!isFormData && !('Content-Type' in baseHeaders)) {
    baseHeaders['Content-Type'] = 'application/json';
  }

  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: baseHeaders,
      body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
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

export const resolveAssetUrl = (assetPath) => {
  if (!assetPath) return '';
  const str = String(assetPath);
  if (/^(?:data|blob|file):/i.test(str)) {
    return str;
  }
  if (/^https?:\/\//i.test(str)) {
    return str;
  }
  if (!API_ORIGIN) return str;
  return `${API_ORIGIN.replace(/\/$/, '')}/${str.replace(/^\/+/, '')}`;
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

function extractLocalities(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const localities = payload.localidades ?? payload.data ?? payload;
  return Array.isArray(localities) ? localities : [];
}

function extractServices(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const services = payload.servicios ?? payload.data ?? payload;
  if (Array.isArray(services)) {
    return services;
  }
  return [];
}

function extractTaxes(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const taxes = payload.impuestos ?? payload.data ?? payload;
  return Array.isArray(taxes) ? taxes : [];
}

function extractSchedule(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const schedule = payload.horarios ?? payload.data ?? payload;
  return Array.isArray(schedule) ? schedule : [];
}

export async function getClubProfile() {
  const response = await api.get('/clubes/mis-datos');
  return extractClub(response);
}

export async function updateClubProfile(payload) {
  const response = await api.patch('/clubes/mis-datos', payload);
  return extractClub(response);
}

export async function listLocalities(provinciaId, query) {
  if (!provinciaId) return [];
  const params = new URLSearchParams();
  params.set('provincia_id', provinciaId);
  if (query) {
    params.set('q', query);
  }
  const response = await api.get(`/geo/localidades?${params.toString()}`);
  return extractLocalities(response);
}

export async function getClubServices() {
  const response = await api.get('/clubes/mis-servicios');
  return extractServices(response);
}

export async function updateClubServices(servicios) {
  const payload = { servicios };
  const response = await api.put('/clubes/mis-servicios', payload);
  return extractServices(response);
}

export async function listAvailableServices() {
  const response = await api.get('/catalogo/servicios');
  return extractServices(response);
}

export async function getClubTaxes() {
  const response = await api.get('/clubes/mis-impuestos');
  return extractTaxes(response);
}

export async function updateClubTaxes(impuestos) {
  const payload = { impuestos };
  const response = await api.put('/clubes/mis-impuestos', payload);
  return extractTaxes(response);
}

export async function getClubSchedule() {
  const response = await api.get('/clubes/mis-horarios');
  return extractSchedule(response);
}

export async function updateClubSchedule(horarios) {
  const payload = { horarios };
  const response = await api.put('/clubes/mis-horarios', payload);
  return extractSchedule(response);
}

export async function uploadClubLogo(file) {
  if (!file) {
    throw new Error('Debés seleccionar una imagen');
  }

  if (typeof FormData === 'undefined') {
    throw new Error('La plataforma no soporta uploads');
  }

  const buildFormData = async () => {
    if (typeof FormData !== 'undefined' && file instanceof FormData) {
      return file;
    }

    const formData = new FormData();

    if (typeof File !== 'undefined' && file instanceof File) {
      formData.append('logo', file);
      return formData;
    }

    const candidate = file && typeof file === 'object' ? file : null;
    const nestedFile = candidate?.file || null;
    const uri = candidate?.uri || candidate?.url || candidate?.path || nestedFile?.uri;
    const name =
      candidate?.name ||
      candidate?.fileName ||
      nestedFile?.name ||
      (uri ? uri.split('/').pop() : null) ||
      `logo-${Date.now()}`;

    const resolveMimeType = () => {
      const normalize = (value) => {
        if (!value) return null;
        const normalized = String(value).trim().toLowerCase();
        if (!normalized) return null;
        const map = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          webp: 'image/webp',
          heic: 'image/heic',
          heif: 'image/heif',
          bmp: 'image/bmp',
          svg: 'image/svg+xml',
          'image/jpg': 'image/jpeg',
        };
        if (normalized in map) {
          return map[normalized];
        }
        if (normalized === 'image' || normalized === 'img') {
          return 'image/jpeg';
        }
        if (normalized.startsWith('image/')) {
          return map[normalized] || normalized;
        }
        return map[normalized] || null;
      };

      const candidateType =
        normalize(candidate?.mimeType) ||
        normalize(candidate?.type) ||
        normalize(candidate?.fileType) ||
        normalize(nestedFile?.type) ||
        normalize(nestedFile?.mimeType);

      return candidateType || 'image/jpeg';
    };

    const type = resolveMimeType();

    if (nestedFile) {
      if (typeof File !== 'undefined' && nestedFile instanceof File) {
        const typedFile =
          type && nestedFile.type !== type
            ? new File([nestedFile], nestedFile.name || name, { type })
            : nestedFile;
        formData.append('logo', typedFile);
      } else {
        formData.append('logo', nestedFile);
      }
      return formData;
    }

    if (!uri) {
      throw new Error('Imagen inválida');
    }

    let blob;
    try {
      const res = await fetch(uri);
      if (!res?.ok) {
        throw new Error('No se pudo leer la imagen');
      }
      blob = await res.blob();
    } catch {
      throw new Error('No se pudo leer la imagen');
    }

    const fallbackType = type || blob.type || 'application/octet-stream';

    if (typeof File !== 'undefined') {
      const fileFromBlob = new File([blob], name, { type: fallbackType });
      formData.append('logo', fileFromBlob);
    } else {
      const typedBlob =
        blob.type === fallbackType || !blob.slice
          ? blob
          : blob.slice(0, blob.size, fallbackType);
      formData.append('logo', typedBlob, name);
    }

    return formData;
  };

  const formData = await buildFormData();
  const response = await api.post('/clubes/mis-datos/logo', formData);
  const club = extractClub(response);
  return club?.foto_logo ?? null;
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
