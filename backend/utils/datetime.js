/**
 * Helpers de fecha y hora.
 */

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

module.exports = { diaSemana1a7, addHoursHHMMSS, isPastDateTime };
