const padTwoDigits = (value) => String(value).padStart(2, '0');

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeHour = (value) => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;

  const parts = str.split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  const [rawHours, rawMinutes, rawSeconds = '0'] = parts;
  if (!/^\d{1,2}$/.test(rawHours) || !/^\d{1,2}$/.test(rawMinutes) || !/^\d{1,2}$/.test(rawSeconds)) {
    return null;
  }

  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  const seconds = Number(rawSeconds);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  if (seconds < 0 || seconds > 59) return null;

  return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
};

const hourToSeconds = (value) => {
  const normalized = normalizeHour(value);
  if (!normalized) return null;
  const [hours, minutes, seconds] = normalized.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

const isTimeInRange = (time, start, end) => {
  const timeSeconds = hourToSeconds(time);
  const startSeconds = hourToSeconds(start);
  const endSeconds = hourToSeconds(end);

  if (timeSeconds === null || startSeconds === null || endSeconds === null) {
    return false;
  }

  if (startSeconds === endSeconds) {
    return true;
  }

  if (startSeconds < endSeconds) {
    return timeSeconds >= startSeconds && timeSeconds < endSeconds;
  }

  return timeSeconds >= startSeconds || timeSeconds < endSeconds;
};

const NIGHT_START_KEYS = [
  'rango_nocturno_inicio',
  'rango_nocturno_desde',
  'horario_nocturno_inicio',
  'horario_nocturno_desde',
  'hora_nocturna_inicio',
  'hora_nocturna_desde',
  'hora_noche_inicio',
  'hora_noche_desde',
  'horaNocturnaInicio',
  'horaNocturnaDesde',
  'nightStart',
  'night_from',
];

const NIGHT_END_KEYS = [
  'rango_nocturno_fin',
  'rango_nocturno_hasta',
  'horario_nocturno_fin',
  'horario_nocturno_hasta',
  'hora_nocturna_fin',
  'hora_nocturna_hasta',
  'hora_noche_fin',
  'hora_noche_hasta',
  'horaNocturnaFin',
  'horaNocturnaHasta',
  'nightEnd',
  'night_to',
];

const extractNightConfigs = (club) => {
  if (!club || typeof club !== 'object') {
    return [];
  }
  const direct = club.configuracion_nocturna ?? club.configuracionNocturna;
  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === 'object') return [direct];
  return [];
};

const extractNightRange = (club) => {
  if (!club || typeof club !== 'object') return null;

  const configs = extractNightConfigs(club);

  const startCandidates = [
    ...NIGHT_START_KEYS.map((key) => club?.[key]),
    ...configs.map(
      (cfg) =>
        cfg &&
        (cfg.inicio ??
          cfg.desde ??
          cfg.start ??
          cfg.startTime ??
          cfg.start_time ??
          cfg.nightStart),
    ),
  ];

  const endCandidates = [
    ...NIGHT_END_KEYS.map((key) => club?.[key]),
    ...configs.map(
      (cfg) =>
        cfg &&
        (cfg.fin ??
          cfg.hasta ??
          cfg.end ??
          cfg.endTime ??
          cfg.end_time ??
          cfg.nightEnd),
    ),
  ];

  const startRaw = startCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  const endRaw = endCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim());

  const start = normalizeHour(startRaw);
  const end = normalizeHour(endRaw);

  if (!start || !end) return null;

  return { start, end };
};

const coalescePrice = (...values) => {
  for (const value of values) {
    const numeric = toNumberOrNull(value);
    if (numeric !== null) {
      return numeric;
    }
  }
  return null;
};

const selectHourlyPrice = ({ cancha = {}, club = {}, horaInicio, tarifa } = {}) => {
  const tarifaPrecio = toNumberOrNull(tarifa && tarifa.precio);
  if (tarifaPrecio !== null) {
    return tarifaPrecio;
  }

  const precioDia = coalescePrice(cancha.precioDia, cancha.precio_dia);
  const precioNoche = coalescePrice(cancha.precioNoche, cancha.precio_noche);
  const precioGenerico = coalescePrice(cancha.precio, cancha.monto_base);

  const horaInicioNormalizada = normalizeHour(horaInicio);
  const nightRange = extractNightRange(club);

  let esHorarioNocturno = false;
  if (horaInicioNormalizada && nightRange) {
    esHorarioNocturno = isTimeInRange(horaInicioNormalizada, nightRange.start, nightRange.end);
  }

  const chooseNight = () => {
    if (precioNoche !== null) return precioNoche;
    if (precioDia !== null) return precioDia;
    if (precioGenerico !== null) return precioGenerico;
    return 0;
  };

  const chooseDay = () => {
    if (precioDia !== null) return precioDia;
    if (precioNoche !== null) return precioNoche;
    if (precioGenerico !== null) return precioGenerico;
    return 0;
  };

  const precioSeleccionado = esHorarioNocturno ? chooseNight() : chooseDay();
  return Number.isFinite(precioSeleccionado) ? precioSeleccionado : 0;
};

const calculateBaseAmount = ({
  cancha = {},
  club = {},
  horaInicio,
  duracionHoras,
  tarifa,
  explicitAmount,
  fallbackAmount,
} = {}) => {
  const explicit = toNumberOrNull(explicitAmount);
  if (explicit !== null) {
    return explicit;
  }

  const duration = toNumberOrNull(duracionHoras);
  const hourlyPrice = toNumberOrNull(selectHourlyPrice({ cancha, club, horaInicio, tarifa }));

  if (hourlyPrice !== null) {
    if (duration !== null && duration > 0) {
      return hourlyPrice * duration;
    }
    return hourlyPrice;
  }

  const fallback = toNumberOrNull(fallbackAmount);
  if (fallback === null) {
    return 0;
  }

  if (duration !== null && duration > 0) {
    return fallback * duration;
  }

  return fallback;
};

const determineRateType = ({ horaInicio, club } = {}) => {
  const nightRange = extractNightRange(club);
  const normalizedStart = normalizeHour(horaInicio);
  if (!nightRange || !normalizedStart) {
    return 'unknown';
  }
  return isTimeInRange(normalizedStart, nightRange.start, nightRange.end) ? 'night' : 'day';
};

module.exports = {
  toNumberOrNull,
  normalizeHour,
  isTimeInRange,
  extractNightRange,
  selectHourlyPrice,
  calculateBaseAmount,
  determineRateType,
};
