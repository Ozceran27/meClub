import { tokenKey, getItem } from './storage';
import { sanitizeTaxesForPayload } from '../utils/taxes';
import { normalizePaymentStatusValue } from '../constants/paymentStatus';

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
  const candidates = [
    payload.localidades,
    payload.data?.localidades,
    payload.data,
    payload,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (candidate && typeof candidate === 'object' && Array.isArray(candidate.localidades)) {
      return candidate.localidades;
    }
  }

  return [];
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

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveIntOrZero = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeMonthlyEconomy = (source = []) => {
  if (!Array.isArray(source)) return [];

  return source
    .map((item, index) => {
      const period = item?.periodo ?? item?.period ?? item?.mes ?? item?.month ?? null;
      const label = item?.label ?? null;
      const ingresos = toPaymentBreakdown(item?.ingresos ?? item?.income ?? item?.ingresosMes);
      const gastos = toNumberOrZero(item?.gastos ?? item?.expenses ?? item?.gastosMes);
      const balance = toNumberOrZero(item?.balance ?? item?.resultado ?? item?.neto);

      if (!period && !label && gastos === 0 && balance === 0 && !Object.values(ingresos).some(Boolean)) {
        return null;
      }

      return {
        periodo: period,
        label,
        ingresos,
        gastos,
        balance,
        index,
      };
    })
    .filter(Boolean);
};

const toPaymentBreakdown = (source = {}) => {
  const base = { pagado: 0, senado: 0, pendiente_pago: 0 };

  if (Array.isArray(source)) {
    return source.reduce((acc, item) => {
      const key = normalizePaymentStatusValue(
        item?.estado_pago ?? item?.estadoPago ?? item?.estado
      );
      const normalizedKey = key || 'pendiente_pago';
      acc[normalizedKey] = (acc[normalizedKey] || 0) + toNumberOrZero(item?.total);
      return acc;
    }, { ...base });
  }

  if (source && typeof source === 'object') {
    return {
      ...base,
      pagado: toNumberOrZero(source.pagado ?? source.pago ?? source.paid),
      senado: toNumberOrZero(source.senado ?? source.señado ?? source.senadoPago),
      pendiente_pago: toNumberOrZero(
        source.pendiente_pago ?? source.pendientePago ?? source.pending
      ),
    };
  }

  return { ...base };
};

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return ['1', 'true', 'si', 'sí', 'on', 'yes'].includes(normalized);
  }
  return false;
};

const normalizeExpenseItem = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const gastoId = toNumberOrNull(raw.gasto_id ?? raw.gastoId ?? raw.id);
  const clubId = toNumberOrNull(raw.club_id ?? raw.clubId);
  const icono = raw.icono ?? raw.icon ?? raw.emoji ?? null;

  return {
    id: gastoId,
    gastoId,
    clubId,
    categoria: raw.categoria || 'Sin categoría',
    descripcion: raw.descripcion ?? null,
    icono,
    icon: icono,
    monto: toNumberOrZero(raw.monto),
    fecha:
      typeof raw.fecha === 'string'
        ? raw.fecha
        : raw.fecha instanceof Date
        ? raw.fecha.toISOString()
        : raw.fecha ?? null,
  };
};

const extractExpenseSummary = (payload) => {
  const summary = payload?.resumen ?? payload?.summary ?? payload ?? {};
  const porCategoria = Array.isArray(summary.porCategoria)
    ? summary.porCategoria.map((item) => ({
        categoria: item?.categoria || 'Sin categoría',
        total: toNumberOrZero(item?.total),
      }))
    : [];
  const total = toNumberOrZero(summary.total ?? porCategoria.reduce((acc, it) => acc + (it?.total || 0), 0));

  return { porCategoria, total };
};

const extractExpenseList = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return { clubId: null, gastos: [], resumen: { porCategoria: [], total: 0 } };
  }

  const gastosRaw =
    payload.gastos ?? payload.data?.gastos ?? payload.data ?? payload.items ?? payload ?? [];
  const gastos = Array.isArray(gastosRaw)
    ? gastosRaw.map((item) => normalizeExpenseItem(item)).filter(Boolean)
    : [];

  const metaRaw = payload.meta ?? payload.pagination ?? {};
  const totalItems = toNumberOrZero(metaRaw.total ?? metaRaw.count ?? gastos.length);
  const pageSize = toNumberOrZero(metaRaw.limit ?? metaRaw.pageSize ?? (gastos.length || 1)) || 1;
  const page = toNumberOrZero(metaRaw.page ?? metaRaw.currentPage) || 1;
  const totalPaginas =
    toNumberOrZero(metaRaw.totalPaginas ?? metaRaw.total_pages ?? metaRaw.pages) ||
    Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    clubId: toNumberOrNull(payload.club_id ?? payload.clubId ?? gastos?.[0]?.clubId),
    gastos,
    resumen: extractExpenseSummary(payload.resumen ?? payload.summary ?? payload),
    meta: { total: totalItems, limit: pageSize, page, totalPaginas },
  };
};

const normalizeMonthlySeries = (source) => {
  if (!Array.isArray(source)) return [];

  return source
    .map((item, index) => {
      if (item === null || item === undefined) return null;

      if (typeof item === 'number') {
        return { periodo: String(index), total: item };
      }

      const period =
        item.periodo ||
        item.period ||
        item.periodo_mes ||
        item.mes ||
        item.month ||
        item.fecha ||
        item.label;

      const total = toNumberOrZero(
        item.total ?? item.monto ?? item.value ?? item.ingresos ?? item.cantidad
      );

      if (!period) return null;

      return { periodo: String(period), total };
    })
    .filter(Boolean);
};

const normalizeDailyIncomeSeries = (raw) => {
  const items = Array.isArray(raw) ? raw : [];
  return items
    .map((item, index) => {
      const total = toNumberOrZero(
        item?.total ?? item?.monto ?? item?.value ?? item?.ingresos ?? item?.cantidad
      );

      if (!Number.isFinite(total)) return null;

      return {
        total,
        fecha: item?.fecha ?? item?.date ?? item?.dia_fecha ?? null,
        dia:
          item?.dia ??
          item?.day ??
          item?.day_of_week ??
          item?.dayOfWeek ??
          item?.weekday ??
          null,
        label: item?.label ?? null,
        index,
      };
    })
    .filter(Boolean);
};

const extractEconomy = (payload) => {
  const data = payload?.data ?? payload ?? {};

  const ingresosMes = toPaymentBreakdown(
    data.ingresos?.mes ?? data.ingresosMes ?? data.ingresos_mes ?? data.ingresosMensuales
  );
  const ingresosSemana = toPaymentBreakdown(
    data.ingresos?.semana ?? data.ingresosSemana ?? data.ingresos_semana ?? data.ingresosSemanales
  );

  const reservasMes = toNumberOrZero(data.reservas?.mes ?? data.reservasMes ?? data.reservas_mes);
  const reservasSemana = toNumberOrZero(
    data.reservas?.semana ?? data.reservasSemana ?? data.reservas_semana
  );

  const economiaMensual = normalizeMonthlyEconomy(
    data.economiaMensual ?? data.flujoMensual ?? data.ingresosGastosMensuales
  );

  const ingresosMensualesHistoricos = normalizeMonthlySeries(
    data.ingresos?.historico ??
      data.ingresos?.historicoMensual ??
      data.ingresos?.mensuales ??
      data.ingresosMensuales ??
      data.ingresos_mensuales ??
      data.ingresosMensualesHistoricos ??
      economiaMensual.map((item) => ({ periodo: item.periodo, total: item.balance + item.gastos }))
  );

  const ingresosDiarios = normalizeDailyIncomeSeries(
    data.ingresos?.diarios ??
      data.ingresosDiarios ??
      data.ingresos_diarios ??
      data.ingresosDiariosSemana
  );

  const semanaSeleccionada =
    data.semanaSeleccionada ?? data.semana ?? data.week ?? data.weekStart ?? data.semana_inicio;

  return {
    ingresos: { mes: ingresosMes, semana: ingresosSemana },
    reservas: { mes: reservasMes, semana: reservasSemana },
    proyeccion: {
      mes: toNumberOrZero(data.proyeccion?.mes ?? data.proyeccionMes ?? data.proyeccion_mes),
      semana: toNumberOrZero(
        data.proyeccion?.semana ?? data.proyeccionSemana ?? data.proyeccion_semana
      ),
    },
    gastos: { mes: toNumberOrZero(data.gastos?.mes ?? data.gastosMes ?? data.gastos_mes) },
    balanceMensual: toNumberOrZero(data.balanceMensual ?? data.balance ?? data.balance_mensual),
    ingresosMensualesHistoricos,
    ingresosDiarios,
    semanaSeleccionada,
    economiaMensual,
  };
};

function normalizeInboxItem(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const inboxId = toNumberOrNull(raw.inbox_id ?? raw.id);
  const messageId = toNumberOrNull(raw.message_id ?? raw.messageId);
  const userId = toNumberOrNull(raw.user_id ?? raw.userId);
  const clubId = toNumberOrNull(raw.club_id ?? raw.clubId);

  const readAt =
    typeof raw.read_at === 'string'
      ? raw.read_at
      : typeof raw.readAt === 'string'
      ? raw.readAt
      : null;

  const createdAt =
    typeof raw.created_at === 'string'
      ? raw.created_at
      : typeof raw.createdAt === 'string'
      ? raw.createdAt
      : null;

  const messageCreatedAt =
    typeof raw.message_created_at === 'string'
      ? raw.message_created_at
      : typeof raw.messageCreatedAt === 'string'
      ? raw.messageCreatedAt
      : null;

  const normalized = {
    inboxId,
    id: inboxId,
    userId,
    clubId,
    messageId,
    isRead: toBoolean(raw.is_read ?? raw.isRead),
    readAt,
    createdAt,
    type: raw.type ?? null,
    title: raw.title ?? null,
    content: raw.content ?? null,
    sender: raw.sender ?? null,
    messageCreatedAt,
  };

  return normalized;
}

function extractInbox(payload) {
  if (!payload || typeof payload !== 'object') {
    return { page: 1, limit: 40, total: 0, inbox: [] };
  }

  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const page = toPositiveIntOrZero(data.page) || 1;
  const limit = toPositiveIntOrZero(data.limit) || 40;
  const total = toPositiveIntOrZero(data.total);
  const inbox = Array.isArray(data.inbox)
    ? data.inbox
        .map((item) => normalizeInboxItem(item))
        .filter((item) => item && item.inboxId != null)
    : [];

  return { page, limit, total, inbox };
}

function normalizeReservation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const reservaId = toNumberOrNull(raw.reserva_id);
  const canchaId = toNumberOrNull(raw.cancha_id);
  const rawEstadoPago =
    raw.estado_pago !== undefined && raw.estado_pago !== null
      ? String(raw.estado_pago).trim()
      : null;

  return {
    reservaId,
    usuarioId: raw.usuario_id != null ? toNumberOrNull(raw.usuario_id) : null,
    creadoPorId: raw.creado_por_id != null ? toNumberOrNull(raw.creado_por_id) : null,
    canchaId,
    canchaNombre: raw.cancha_nombre ?? null,
    fecha: typeof raw.fecha === 'string' ? raw.fecha : null,
    horaInicio: typeof raw.hora_inicio === 'string' ? raw.hora_inicio : null,
    horaFin: typeof raw.hora_fin === 'string' ? raw.hora_fin : null,
    duracionHoras: toPositiveIntOrZero(raw.duracion_horas),
    estado: raw.estado ?? null,
    estadoPago: normalizePaymentStatusValue(rawEstadoPago) || null,
    monto: toNumberOrNull(raw.monto),
    montoBase: toNumberOrNull(raw.monto_base),
    montoGrabacion: toNumberOrNull(raw.monto_grabacion),
    grabacionSolicitada: toBoolean(raw.grabacion_solicitada),
    tipoReserva: raw.tipo_reserva ?? null,
    contactoNombre: raw.contacto_nombre ?? '',
    contactoApellido: raw.contacto_apellido ?? '',
    contactoTelefono: raw.contacto_telefono ?? '',
    usuarioNombre: raw.usuario_nombre ?? null,
    usuarioApellido: raw.usuario_apellido ?? null,
    usuarioEmail: raw.usuario_email ?? null,
    creadoPorNombre: raw.creado_por_nombre ?? null,
    creadoPorApellido: raw.creado_por_apellido ?? null,
    creadoPorEmail: raw.creado_por_email ?? null,
    estadoTemporal: raw.estado_temporal ?? null,
  };
}

function normalizeReservationList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeReservation(item))
    .filter((item) => item && item.reservaId != null && item.canchaId != null);
}

function extractReservation(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [payload.reserva, payload.data?.reserva, payload.data, payload];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const normalized = normalizeReservation(candidate);
      if (normalized) return normalized;
    }
  }
  return null;
}

function normalizeTotales(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const porEstadoSource =
    source.por_estado && typeof source.por_estado === 'object' ? source.por_estado : {};
  const porEstado = Object.fromEntries(
    Object.entries(porEstadoSource).map(([key, value]) => [key, toNumberOrZero(value)])
  );
  return {
    total: toNumberOrZero(source.total),
    activas: toNumberOrZero(source.activas),
    canceladas: toNumberOrZero(source.canceladas),
    montoTotal: toNumberOrZero(source.monto_total),
    montoBaseTotal: toNumberOrZero(source.monto_base_total),
    montoGrabacionTotal: toNumberOrZero(source.monto_grabacion_total),
    porEstado,
  };
}

function normalizeResumenEstados(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    estado: item?.estado ?? null,
    total: toNumberOrZero(item?.total),
    montoTotal: toNumberOrZero(item?.monto_total),
    montoBaseTotal: toNumberOrZero(item?.monto_base_total),
    montoGrabacionTotal: toNumberOrZero(item?.monto_grabacion_total),
  }));
}

function extractReservationsPanel(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      fecha: '',
      horaActual: '',
      totales: { hoy: normalizeTotales(), semana: normalizeTotales() },
      resumenEstadosHoy: [],
      agenda: [],
      enCurso: { jugandoAhora: [], proximos: [], siguiente: null },
      club: { clubId: null, precioGrabacion: 0 },
    };
  }

  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const agenda = Array.isArray(data.agenda)
    ? data.agenda.map((item) => ({
        canchaId: toNumberOrNull(item?.cancha_id),
        canchaNombre: item?.cancha_nombre ?? null,
        precio: toNumberOrNull(item?.precio),
        precioDia: toNumberOrNull(item?.precio_dia ?? item?.precioDia),
        precioNoche: toNumberOrNull(item?.precio_noche ?? item?.precioNoche),
        reservas: normalizeReservationList(item?.reservas),
      }))
    : [];

  const enCursoData = data.en_curso && typeof data.en_curso === 'object' ? data.en_curso : {};
  const jugandoAhora = normalizeReservationList(enCursoData.jugando_ahora);
  const proximos = normalizeReservationList(enCursoData.proximos);
  const siguiente = enCursoData.siguiente ? normalizeReservation(enCursoData.siguiente) : null;

  const clubData = data.club && typeof data.club === 'object' ? data.club : {};
  const nightStart =
    typeof clubData.horaNocturnaInicio === 'string'
      ? clubData.horaNocturnaInicio
      : typeof clubData.hora_nocturna_inicio === 'string'
      ? clubData.hora_nocturna_inicio
      : null;
  const nightEnd =
    typeof clubData.horaNocturnaFin === 'string'
      ? clubData.horaNocturnaFin
      : typeof clubData.hora_nocturna_fin === 'string'
      ? clubData.hora_nocturna_fin
      : null;

  return {
    fecha: typeof data.fecha === 'string' ? data.fecha : '',
    horaActual: typeof data.hora_actual === 'string' ? data.hora_actual : '',
    totales: {
      hoy: normalizeTotales(data.totales?.hoy),
      semana: normalizeTotales(data.totales?.semana),
    },
    resumenEstadosHoy: normalizeResumenEstados(data.resumen_estados_hoy),
    agenda: agenda.filter((item) => item.canchaId != null),
    enCurso: {
      jugandoAhora,
      proximos,
      siguiente,
    },
    club: {
      clubId: toNumberOrNull(clubData.club_id),
      precioGrabacion: toNumberOrZero(clubData.precio_grabacion),
      horaNocturnaInicio: nightStart,
      horaNocturnaFin: nightEnd,
      hora_nocturna_inicio: nightStart,
      hora_nocturna_fin: nightEnd,
    },
  };
}

function normalizePlayer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = toNumberOrNull(raw.usuario_id);
  return {
    id,
    nombre: raw.nombre ?? '',
    apellido: raw.apellido ?? '',
    telefono: raw.telefono ?? '',
    nombreCompleto: [raw.nombre, raw.apellido].filter(Boolean).join(' ').trim(),
  };
}

function extractPlayerSearch(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const candidates = [payload.usuarios, payload.data?.usuarios, payload.data, payload];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((item) => normalizePlayer(item)).filter((item) => item && item.id != null);
    }
    if (candidate && typeof candidate === 'object' && Array.isArray(candidate.usuarios)) {
      return candidate.usuarios
        .map((item) => normalizePlayer(item))
        .filter((item) => item && item.id != null);
    }
  }
  return [];
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
  if (query) {
    params.set('q', query);
  }
  const search = params.toString();
  const path = `/provincias/${encodeURIComponent(provinciaId)}/localidades${
    search ? `?${search}` : ''
  }`;
  const response = await api.get(path);
  return extractLocalities(response);
}

export async function getClubServices() {
  const response = await api.get('/clubes/mis-servicios');
  return extractServices(response);
}

export async function updateClubServices(servicioIds) {
  const payload = { servicio_ids: Array.isArray(servicioIds) ? servicioIds : [] };
  const response = await api.patch('/clubes/mis-servicios', payload);
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
  const items = sanitizeTaxesForPayload(impuestos);
  const response = await api.patch('/clubes/mis-impuestos', { items });
  return extractTaxes(response);
}

export async function getClubSchedule() {
  const response = await api.get('/clubes/mis-horarios');
  return extractSchedule(response);
}

export async function updateClubSchedule(items) {
  const payload = { items: Array.isArray(items) ? items : [] };
  const response = await api.patch('/clubes/mis-horarios', payload);
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

function extractCourts(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const candidates = [payload.canchas, payload.data, payload];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (candidate && typeof candidate === 'object' && Array.isArray(candidate.canchas)) {
      return candidate.canchas;
    }
  }
  return [];
}

function extractCourt(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.cancha && typeof payload.cancha === 'object') {
    return payload.cancha;
  }
  if (payload.data && typeof payload.data === 'object' && payload.data.cancha) {
    return payload.data.cancha;
  }
  return payload;
}

function extractCourtSummary(payload) {
  if (!payload || typeof payload !== 'object') return {};
  if (payload.resumen && typeof payload.resumen === 'object') {
    return payload.resumen;
  }
  if (payload.data && typeof payload.data === 'object' && payload.data.resumen) {
    return payload.data.resumen;
  }
  return payload;
}

export async function getClubCourts() {
  const response = await api.get('/clubes/mis-canchas');
  return extractCourts(response);
}

export async function createClubCourt(payload) {
  const response = await api.post('/clubes/mis-canchas', payload);
  return extractCourt(response);
}

export async function updateClubCourt(canchaId, payload) {
  if (!canchaId) {
    throw new Error('Identificador de cancha inválido');
  }
  const response = await api.patch(`/clubes/mis-canchas/${encodeURIComponent(canchaId)}`, payload);
  return extractCourt(response);
}

export async function deleteClubCourt(canchaId) {
  if (!canchaId) {
    throw new Error('Identificador de cancha inválido');
  }
  const response = await api.del(`/clubes/mis-canchas/${encodeURIComponent(canchaId)}`);
  return response;
}

export async function uploadClubCourtImage(canchaId, file) {
  if (!canchaId) {
    throw new Error('Identificador de cancha inválido');
  }
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
      formData.append('imagen', file);
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
      `cancha-${Date.now()}`;

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
        formData.append('imagen', typedFile);
      } else {
        formData.append('imagen', nestedFile);
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
      formData.append('imagen', fileFromBlob);
    } else {
      const typedBlob =
        blob.type === fallbackType || !blob.slice
          ? blob
          : blob.slice(0, blob.size, fallbackType);
      formData.append('imagen', typedBlob, name);
    }

    return formData;
  };

  const formData = await buildFormData();
  const response = await api.post(
    `/clubes/mis-canchas/${encodeURIComponent(canchaId)}/imagen`,
    formData
  );
  const court = extractCourt(response);
  return court?.imagen_url ?? response?.imagen_url ?? null;
}

export async function getClubCourtSummary(canchaId) {
  if (!canchaId) {
    throw new Error('Identificador de cancha inválido');
  }
  const response = await api.get(`/clubes/mis-canchas/${encodeURIComponent(canchaId)}/resumen`);
  return extractCourtSummary(response);
}

export async function listSports() {
  const response = await api.get('/deportes', { auth: false });
  if (Array.isArray(response)) {
    return response;
  }
  if (response?.data && Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}

export async function listProvinces() {
  const response = await api.get('/provincias');
  return extractProvinces(response);
}

export async function getClubSummary({ clubId }) {
  if (clubId === undefined) {
    return {
      courtsAvailable: 0,
      courtsMaintenance: 0,
      courtsInactive: 0,
      reservasHoy: 0,
      reservasSemana: 0,
      economiaMes: 0,
      courtTypes: [],
      reservasPagadasHoy: 0,
      reservasFinalizadasHoy: 0,
      reservasDiarias: [],
      reservasMensuales: [],
      reservasMesActual: 0,
      weatherStatus: null,
      weatherTemp: null,
    };
  }
  try {
    const { data } = await api.get(`/clubes/${clubId}/resumen`);
    if (!data) {
      // Backend no respondió correctamente
      return {
        courtsAvailable: 0,
        courtsMaintenance: 0,
        courtsInactive: 0,
        reservasHoy: 0,
        reservasSemana: 0,
        economiaMes: 0,
        courtTypes: [],
        reservasPagadasHoy: 0,
        reservasFinalizadasHoy: 0,
        reservasDiarias: [],
        reservasMensuales: [],
        reservasMesActual: 0,
        weatherStatus: null,
        weatherTemp: null,
      };
    }
    // Esperado: { courtsAvailable, courtsMaintenance, courtsInactive, reservasHoy, reservasSemana, economiaMes, courtTypes, reservasPagadasHoy, reservasFinalizadasHoy, reservasMesActual, reservasDiarias, reservasMensuales }
    const normalizedCourtTypes = Array.isArray(data.courtTypes)
      ? data.courtTypes.map((item) => ({
          etiqueta: (item?.etiqueta || item?.label || 'Otro').toString(),
          total: toNumberOrZero(item?.total),
        }))
      : [];
    return {
      courtsAvailable: data.courtsAvailable ?? 0,
      courtsMaintenance: data.courtsMaintenance ?? 0,
      courtsInactive: data.courtsInactive ?? 0,
      reservasHoy: data.reservasHoy ?? 0,
      reservasSemana: data.reservasSemana ?? 0,
      economiaMes: data.economiaMes ?? 0,
      courtTypes: normalizedCourtTypes,
      reservasPagadasHoy: data.reservasPagadasHoy ?? 0,
      reservasFinalizadasHoy: data.reservasFinalizadasHoy ?? 0,
      reservasMesActual: data.reservasMesActual ?? 0,
      reservasDiarias: Array.isArray(data.reservasDiarias) ? data.reservasDiarias : [],
      reservasMensuales: Array.isArray(data.reservasMensuales) ? data.reservasMensuales : [],
      weatherStatus: data.weatherStatus ?? null,
      weatherTemp: data.weatherTemp ?? null,
    };
  } catch (err) {
    console.warn('getClubSummary error', err);
    throw err;
  }
}

export async function getClubEconomy({ clubId, weekStart }) {
  if (!clubId && clubId !== 0) {
    throw new Error('Identificador de club inválido');
  }

  const params = new URLSearchParams();
  if (weekStart) {
    params.set('semana', weekStart);
  }
  const search = params.toString();
  const path = `/clubes/${encodeURIComponent(clubId)}/economia${search ? `?${search}` : ''}`;

  const response = await api.get(path);
  return extractEconomy(response);
}

export async function listClubExpenses({ date, page, limit } = {}) {
  const params = new URLSearchParams();
  if (date) params.set('fecha', date);
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  const search = params.toString();
  const response = await api.get(`/clubes/mis-gastos${search ? `?${search}` : ''}`);
  return extractExpenseList(response);
}

export async function createClubExpense({ categoria, descripcion, monto, fecha, icono } = {}) {
  if (!categoria || monto === undefined || monto === null) {
    throw new Error('categoria y monto son requeridos');
  }

  const payload = { categoria, monto };
  if (descripcion !== undefined) payload.descripcion = descripcion;
  if (icono !== undefined) payload.icono = icono;
  if (fecha !== undefined) payload.fecha = fecha;

  const response = await api.post('/clubes/mis-gastos', payload);
  const gasto = response?.gasto ?? response?.data ?? response;
  return normalizeExpenseItem(gasto);
}

export async function updateClubExpense(gastoId, updates = {}) {
  if (!gastoId && gastoId !== 0) {
    throw new Error('Identificador de gasto inválido');
  }

  const payload = {};
  if (updates.categoria !== undefined) payload.categoria = updates.categoria;
  if (updates.descripcion !== undefined) payload.descripcion = updates.descripcion;
  if (updates.monto !== undefined) payload.monto = updates.monto;
  if (updates.icono !== undefined) payload.icono = updates.icono;
  if (updates.fecha !== undefined) payload.fecha = updates.fecha;

  const response = await api.put(`/clubes/mis-gastos/${encodeURIComponent(gastoId)}`, payload);
  const gasto = response?.gasto ?? response?.data ?? response;
  return normalizeExpenseItem(gasto);
}

export async function deleteClubExpense(gastoId) {
  if (!gastoId && gastoId !== 0) {
    throw new Error('Identificador de gasto inválido');
  }

  await api.del(`/clubes/mis-gastos/${encodeURIComponent(gastoId)}`);
  return true;
}

export async function getReservationsPanel({ date } = {}) {
  const params = new URLSearchParams();
  if (date) {
    params.set('fecha', date);
  }
  const search = params.toString();
  const path = `/reservas/panel${search ? `?${search}` : ''}`;
  const response = await api.get(path);
  return extractReservationsPanel(response);
}

export async function createClubReservation(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Datos de reserva inválidos');
  }
  const response = await api.post('/reservas', payload);
  return extractReservation(response);
}

export async function deleteClubReservation(reservaId) {
  if (reservaId === undefined || reservaId === null || reservaId === '') {
    throw new Error('Identificador de reserva inválido');
  }
  await api.del(`/reservas/${encodeURIComponent(reservaId)}`);
  return true;
}

export async function updateReservationStatus({ reservaId, estado, estado_pago }) {
  if (reservaId === undefined || reservaId === null || reservaId === '') {
    throw new Error('Identificador de reserva inválido');
  }

  const payload = {};
  if (estado !== undefined) {
    payload.estado = estado;
  }
  if (estado_pago !== undefined) {
    payload.estado_pago = estado_pago;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('No hay datos para actualizar');
  }

  const response = await api.patch(
    `/reservas/${encodeURIComponent(reservaId)}/estado`,
    payload
  );
  return extractReservation(response);
}

export async function searchPlayers(term, { limit } = {}) {
  const params = new URLSearchParams();
  if (term) {
    params.set('q', term);
  }
  if (limit) {
    params.set('limit', limit);
  }
  const search = params.toString();
  const response = await api.get(`/usuarios/buscar${search ? `?${search}` : ''}`);
  return extractPlayerSearch(response);
}

export async function getInbox({ page = 1, limit = 40 } = {}) {
  const params = new URLSearchParams();
  if (page !== undefined && page !== null) {
    params.set('page', page);
  }
  if (limit !== undefined && limit !== null) {
    params.set('limit', limit);
  }
  const search = params.toString();
  const response = await api.get(`/mensajes/inbox${search ? `?${search}` : ''}`);
  return extractInbox(response);
}

export async function getInboxSummary() {
  try {
    const response = await api.get('/mensajes/inbox/resumen');
    const data = response?.data ?? response ?? {};
    const total = toPositiveIntOrZero(data.total ?? data.totalCount);
    const unreadCount = toPositiveIntOrZero(
      data.unreadCount ?? data.unread ?? data.no_leidos ?? data.noLeidos
    );
    return { total, unreadCount };
  } catch (error) {
    try {
      const fallback = await getInbox({ page: 1, limit: 1 });
      const unreadFromPage = Array.isArray(fallback?.inbox)
        ? fallback.inbox.filter((item) => !item.isRead).length
        : 0;
      return {
        total: toPositiveIntOrZero(fallback?.total),
        unreadCount: unreadFromPage,
      };
    } catch (fallbackError) {
      throw fallbackError instanceof Error
        ? fallbackError
        : error instanceof Error
        ? error
        : new Error('No se pudo obtener el resumen del buzón');
    }
  }
}

export async function markInboxRead(inboxId) {
  if (inboxId === undefined || inboxId === null || inboxId === '') {
    throw new Error('Identificador de inbox inválido');
  }

  await api.patch(`/mensajes/inbox/${encodeURIComponent(inboxId)}/leer`);
  return true;
}

export async function deleteInbox(inboxId) {
  if (inboxId === undefined || inboxId === null || inboxId === '') {
    throw new Error('Identificador de inbox inválido');
  }

  await api.del(`/mensajes/inbox/${encodeURIComponent(inboxId)}`);
  return true;
}

export async function createSystemMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Datos de mensaje inválidos');
  }

  const response = await api.post('/mensajes', payload);
  return response?.message ?? response;
}

export async function sendBroadcastMessage({ type = 'info', title, content, sender } = {}) {
  if (!title || !content) {
    throw new Error('title y content son requeridos');
  }

  const payload = { type, title, content };
  if (sender) {
    payload.sender = sender;
  }

  return api.post('/mensajes/broadcast', payload);
}

