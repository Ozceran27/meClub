export const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export const DAY_NUMBER_TO_KEY = DAYS.reduce((acc, day, index) => {
  acc[index + 1] = day.key;
  return acc;
}, {});

export const DAY_KEY_TO_NUMBER = DAYS.reduce((acc, day, index) => {
  acc[day.key] = index + 1;
  return acc;
}, {});

export const STATUS_LABELS = {
  profile: 'Perfil',
  schedule: 'Horarios',
  services: 'Servicios',
  taxes: 'Impuestos',
};

export const parseMaybeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

let clientIdCounter = 0;
export const createClientId = () => {
  clientIdCounter += 1;
  return `tmp-${Date.now()}-${clientIdCounter}`;
};

export const createEmptySchedule = () =>
  DAYS.reduce((acc, day) => {
    acc[day.key] = { enabled: false, ranges: [] };
    return acc;
  }, {});

export const normalizeCatalogServices = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const id = item?.id ?? item?.value ?? item?.key ?? item?.servicio_id ?? item?.codigo;
      if (id === null || id === undefined) return null;
      return {
        id: String(id),
        nombre: item?.nombre ?? item?.name ?? 'Servicio sin nombre',
        descripcion: item?.descripcion ?? item?.description ?? '',
      };
    })
    .filter(Boolean);
};

export const normalizeServices = (services) => {
  if (!Array.isArray(services)) return [];
  return services
    .map((service) => {
      if (service === null || service === undefined) return null;
      if (typeof service === 'object') {
        if (service?.seleccionado === false) return null;
        const id = service?.id ?? service?.servicio_id ?? service?.codigo ?? service?.value;
        return id === null || id === undefined ? null : String(id);
      }
      return String(service);
    })
    .filter((value) => value !== null && value !== undefined && value !== '');
};

export const normalizeTaxes = (taxes) => {
  if (!Array.isArray(taxes)) return [];
  return taxes.map((tax, index) => ({
    id: tax?.id ?? tax?.impuesto_id ?? `tmp-${index}-${Date.now()}`,
    nombre: tax?.nombre ?? tax?.name ?? '',
    porcentaje:
      tax?.porcentaje !== undefined && tax?.porcentaje !== null
        ? String(tax.porcentaje)
        : '',
  }));
};

export const normalizeTimeToHHMM = (value) => {
  if (value === undefined || value === null) return '';
  const str = String(value).trim();
  if (!str) return '';

  const match = str.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!match) return '';

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const seconds = Number(match[3] ?? '0');

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return '';
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const extractRanges = (ranges) => {
  if (!Array.isArray(ranges)) return [];
  return ranges
    .map((range) => {
      const start = range?.desde ?? range?.inicio ?? range?.start ?? range?.from ?? '';
      const end = range?.hasta ?? range?.fin ?? range?.end ?? range?.to ?? '';
      if (!start || !end) return null;
      return { start, end };
    })
    .filter(Boolean);
};

export const normalizeSchedule = (schedule) => {
  const base = createEmptySchedule();
  if (!Array.isArray(schedule)) return base;
  schedule.forEach((entry) => {
    let normalizedKey;

    const dayNumber =
      entry?.dia_semana ?? entry?.dia_num ?? entry?.diaNumero ?? entry?.numero ?? null;
    if (dayNumber !== null && dayNumber !== undefined) {
      const numeric = Number(dayNumber);
      if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) {
        normalizedKey = DAY_NUMBER_TO_KEY[numeric];
      }
    }

    if (!normalizedKey) {
      const rawKey =
        (typeof entry?.dia === 'string' && entry.dia) ||
        (typeof entry?.day === 'string' && entry.day) ||
        (typeof entry?.nombre === 'string' && entry.nombre) ||
        entry?.key ||
        entry?.id;
      if (!rawKey) return;
      const lowerKey = String(rawKey).toLowerCase();
      if (!(lowerKey in base)) return;
      normalizedKey = lowerKey;
    }

    const start = entry?.abre ?? entry?.desde ?? entry?.inicio ?? entry?.start ?? entry?.from;
    const end = entry?.cierra ?? entry?.hasta ?? entry?.fin ?? entry?.end ?? entry?.to;

    let ranges = [];
    if (start && end) {
      ranges = [{ start, end }];
    } else {
      ranges = extractRanges(entry?.horarios ?? entry?.rangos ?? entry?.slots);
    }

    base[normalizedKey] = {
      enabled: entry?.activo ?? entry?.habilitado ?? entry?.enabled ?? ranges.length > 0,
      ranges,
    };
  });
  return base;
};

export const denormalizeSchedule = (schedule) => {
  if (!schedule || typeof schedule !== 'object') return [];

  return DAYS.map((day) => {
    const value = schedule?.[day.key] ?? {};
    const ranges = Array.isArray(value?.ranges) ? value.ranges : [];
    const firstRange = ranges.find((range) => range?.start && range?.end) || null;
    const hasValidRange = Boolean(firstRange);

    return {
      dia_semana: DAY_KEY_TO_NUMBER[day.key],
      abre: hasValidRange ? firstRange.start : null,
      cierra: hasValidRange ? firstRange.end : null,
      activo: Boolean(value?.enabled) && hasValidRange,
    };
  }).filter((item) => item.abre && item.cierra);
};

export const sanitizeServicesForPayload = (services) => {
  if (!Array.isArray(services)) return [];
  return services
    .map((item) => {
      if (item === null || item === undefined) return null;
      let value = item;
      if (typeof value === 'object') {
        const id = value?.id ?? value?.servicio_id ?? value?.codigo ?? value?.value;
        if (id === null || id === undefined) return null;
        value = id;
      }
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
      const str = String(value).trim();
      return str ? str : null;
    })
    .filter((value) => value !== null);
};

export const initialSaveStatus = Object.keys(STATUS_LABELS).reduce((acc, key) => {
  acc[key] = { state: 'idle', message: '' };
  return acc;
}, {});

export const splitAddress = (value) => {
  if (typeof value !== 'string') {
    return { street: '', number: '' };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { street: '', number: '' };
  }

  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1];
  if (last && /\d/.test(last)) {
    return {
      street: parts.slice(0, -1).join(' ').trim(),
      number: last.trim(),
    };
  }

  return { street: trimmed, number: '' };
};

export const composeAddress = (street, number) => {
  const safeStreet = typeof street === 'string' ? street.trim() : '';
  const safeNumber = typeof number === 'string' ? number.trim() : '';
  if (safeStreet && safeNumber) {
    return `${safeStreet} ${safeNumber}`;
  }
  return safeStreet || safeNumber || '';
};

export const buildFormState = (source = {}, fallback = {}) => {
  const servicios = normalizeServices(source?.servicios ?? fallback?.servicios ?? []);
  const impuestos = normalizeTaxes(source?.impuestos ?? fallback?.impuestos ?? []);

  const rawSchedule = source?.horarios ?? fallback?.horarios;
  let horarios;
  if (Array.isArray(rawSchedule)) {
    horarios = normalizeSchedule(rawSchedule);
  } else if (rawSchedule && typeof rawSchedule === 'object') {
    horarios = rawSchedule;
  } else {
    horarios = createEmptySchedule();
  }

  const direccion = source?.direccion ?? fallback?.direccion ?? '';
  const { street: direccion_calle, number: direccion_numero } = splitAddress(direccion);

  const hora_nocturna_inicio = normalizeTimeToHHMM(
    source?.hora_nocturna_inicio ?? fallback?.hora_nocturna_inicio ?? null
  );
  const hora_nocturna_fin = normalizeTimeToHHMM(
    source?.hora_nocturna_fin ?? fallback?.hora_nocturna_fin ?? null
  );

  return {
    nombre: source?.nombre ?? fallback?.nombre ?? '',
    descripcion: source?.descripcion ?? fallback?.descripcion ?? '',
    foto_logo: source?.foto_logo ?? fallback?.foto_logo ?? '',
    provincia_id: source?.provincia_id ?? fallback?.provincia_id ?? null,
    localidad_id: source?.localidad_id ?? fallback?.localidad_id ?? null,
    localidad_nombre:
      source?.localidad_nombre ?? source?.localidad?.nombre ?? fallback?.localidad_nombre ?? '',
    telefono_contacto: source?.telefono_contacto ?? fallback?.telefono_contacto ?? '',
    email_contacto: source?.email_contacto ?? fallback?.email_contacto ?? '',
    direccion,
    direccion_calle,
    direccion_numero,
    latitud: parseMaybeNumber(source?.latitud ?? fallback?.latitud ?? null),
    longitud: parseMaybeNumber(source?.longitud ?? fallback?.longitud ?? null),
    google_place_id: source?.google_place_id ?? fallback?.google_place_id ?? '',
    servicios,
    impuestos,
    horarios,
    hora_nocturna_inicio,
    hora_nocturna_fin,
  };
};
