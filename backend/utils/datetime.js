/**
 * Helpers de fecha y hora.
 */

const TWO_DIGITS = (value) => String(value).padStart(2, '0');

const isFiniteNumber = (value) => Number.isFinite(value);

const toSeconds = (hours, minutes, seconds) => hours * 3600 + minutes * 60 + seconds;

/**
 * Devuelve el número de día de la semana (1=Lunes ... 7=Domingo) para una fecha ISO.
 * @param {string} yyyy_mm_dd - Fecha en formato YYYY-MM-DD.
 * @returns {number|null} Día de la semana (1-7) o null si la fecha es inválida.
 */
function diaSemana1a7(yyyy_mm_dd) {
  const d = new Date(`${yyyy_mm_dd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dow0 = d.getUTCDay(); // 0..6
  return dow0 === 0 ? 7 : dow0; // 1..7 (L=1 ... D=7)
}

/**
 * Suma una cantidad de horas a una hora HH:MM:SS.
 * @param {string} hhmmss - Hora en formato HH:MM:SS.
 * @param {number} hours - Cantidad de horas a sumar.
 * @returns {string|null} Nueva hora HH:MM:SS o null si la entrada es inválida.
 */
function addHoursHHMMSS(hhmmss, hours) {
  const [h, m, s] = hhmmss.split(':').map(Number);
  if ([h, m, s].some((x) => Number.isNaN(x))) return null;
  const base = new Date(Date.UTC(1970, 0, 1, h, m, s || 0));
  base.setUTCHours(base.getUTCHours() + Number(hours));
  const hh = String(base.getUTCHours()).padStart(2, '0');
  const mm = String(base.getUTCMinutes()).padStart(2, '0');
  const ss = String(base.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Normaliza una cadena de hora en formato HH:MM[:SS] a HH:MM:SS.
 * @param {string} value - Hora a normalizar.
 * @returns {string|null} Hora normalizada o null si la entrada es inválida.
 */
function normalizeHour(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  const [rawHours, rawMinutes, rawSeconds = '0'] = parts;
  if (!/^\d{1,2}$/.test(rawHours) || !/^\d{1,2}$/.test(rawMinutes) || !/^\d{1,2}$/.test(rawSeconds)) {
    return null;
  }

  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  const seconds = Number(rawSeconds);

  if (!isFiniteNumber(hours) || !isFiniteNumber(minutes) || !isFiniteNumber(seconds)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  if (seconds < 0 || seconds > 59) return null;

  return `${TWO_DIGITS(hours)}:${TWO_DIGITS(minutes)}:${TWO_DIGITS(seconds)}`;
}

const hourToSeconds = (value) => {
  const normalized = normalizeHour(value);
  if (!normalized) return null;
  const [hours, minutes, seconds] = normalized.split(':').map(Number);
  return toSeconds(hours, minutes, seconds);
};

/**
 * Determina si una hora cae dentro de un rango horario.
 * Considera rangos que pueden cruzar la medianoche.
 * @param {string} time - Hora a evaluar (HH:MM[:SS]).
 * @param {string} start - Inicio del rango (HH:MM[:SS]).
 * @param {string} end - Fin del rango (HH:MM[:SS]).
 * @returns {boolean} true si la hora pertenece al rango.
 */
function isTimeInRange(time, start, end) {
  const timeSeconds = hourToSeconds(time);
  const startSeconds = hourToSeconds(start);
  const endSeconds = hourToSeconds(end);

  if (timeSeconds === null || startSeconds === null || endSeconds === null) {
    return false;
  }

  if (startSeconds === endSeconds) {
    // El rango cubre las 24 horas.
    return true;
  }

  if (startSeconds < endSeconds) {
    return timeSeconds >= startSeconds && timeSeconds < endSeconds;
  }

  // Rango cruzando medianoche (ej: 22:00 -> 06:00)
  return timeSeconds >= startSeconds || timeSeconds < endSeconds;
}

/**
 * Indica si un día y hora dados están en el pasado respecto a la hora actual.
 * @param {string} yyyy_mm_dd - Fecha en formato YYYY-MM-DD.
 * @param {string} hhmmss - Hora en formato HH:MM:SS.
 * @returns {boolean} true si la fecha y hora están en el pasado.
 */
function isPastDateTime(yyyy_mm_dd, hhmmss) {
  const now = new Date();
  const dt = new Date(`${yyyy_mm_dd}T${hhmmss}`);
  return dt.getTime() < now.getTime();
}

module.exports = {
  diaSemana1a7,
  addHoursHHMMSS,
  isPastDateTime,
  normalizeHour,
  isTimeInRange,
};
