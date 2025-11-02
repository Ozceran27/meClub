const ESTADOS_RESERVA_ACTIVOS = Object.freeze(['pendiente', 'confirmada', 'pagada']);

const esEstadoReservaActivo = (estado) => ESTADOS_RESERVA_ACTIVOS.includes(estado);

module.exports = {
  ESTADOS_RESERVA_ACTIVOS,
  esEstadoReservaActivo,
};
