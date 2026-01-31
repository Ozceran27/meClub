const ESTADOS_EVENTO = new Set(['inactivo', 'activo', 'pausado', 'finalizado']);
const TIPOS_EVENTO = new Set(['torneo', 'copa', 'liga', 'amistoso']);
const LIMITES_EQUIPOS_POR_TIPO = {
  torneo: 40,
  copa: 64,
  liga: 20,
  amistoso: 2,
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeTipo = (value) => {
  const parsed = normalizeString(value);
  return parsed ? parsed.toLowerCase() : null;
};

const getLimitePorTipo = (tipo) => {
  if (!tipo) return null;
  return LIMITES_EQUIPOS_POR_TIPO[tipo] ?? null;
};

const validateEstado = (estado) => {
  if (!estado) return null;
  const normalized = normalizeString(estado);
  if (!normalized || !ESTADOS_EVENTO.has(normalized)) {
    const error = new Error('estado inválido');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const validateTipo = (tipo) => {
  if (!tipo) return null;
  const normalized = normalizeTipo(tipo);
  if (!normalized || !TIPOS_EVENTO.has(normalized)) {
    const error = new Error('tipo inválido');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const validateClubPermisoTipo = (tipo, club) => {
  if (!tipo || !club) return;
  if (['torneo', 'copa'].includes(tipo) && Number(club.nivel_id) < 2) {
    const error = new Error('El club no tiene nivel suficiente para crear torneos o copas');
    error.statusCode = 403;
    throw error;
  }
};

const validateLimiteEquipos = (tipo, limite) => {
  if (limite === undefined || limite === null) return null;
  const numeric = Number(limite);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    const error = new Error('limite_equipos debe ser un entero positivo');
    error.statusCode = 400;
    throw error;
  }
  const max = getLimitePorTipo(tipo);
  if (max && numeric > max) {
    const error = new Error(`limite_equipos supera el máximo permitido para ${tipo}`);
    error.statusCode = 400;
    throw error;
  }
  return numeric;
};

const resolveRegionalProvincia = ({ zona, zona_regional, provincia_id }, club) => {
  const zonaValue = normalizeString(zona);
  const zonaRegional = zonaValue === 'regional' || zona_regional === true || zona_regional === 1;
  if (!zonaRegional) return provincia_id ?? null;
  if (!club || !club.provincia_id) {
    const error = new Error('No se puede aplicar zona regional sin provincia en el club');
    error.statusCode = 400;
    throw error;
  }
  if (provincia_id && Number(provincia_id) !== Number(club.provincia_id)) {
    const error = new Error('provincia_id debe coincidir con la provincia del club para zona regional');
    error.statusCode = 400;
    throw error;
  }
  return Number(club.provincia_id);
};

const isZonaRegional = (zona, zona_regional) => {
  const zonaValue = normalizeString(zona);
  return zonaValue === 'regional' || zona_regional === true || zona_regional === 1;
};

module.exports = {
  ESTADOS_EVENTO,
  TIPOS_EVENTO,
  LIMITES_EQUIPOS_POR_TIPO,
  normalizeTipo,
  getLimitePorTipo,
  validateEstado,
  validateTipo,
  validateClubPermisoTipo,
  validateLimiteEquipos,
  resolveRegionalProvincia,
  isZonaRegional,
};
