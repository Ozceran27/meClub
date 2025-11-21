const ESTADOS_RESERVA_ACTIVOS = Object.freeze(['pendiente', 'confirmada', 'pagada']);

const ESTADOS_RESERVA_PERMITIDOS = Object.freeze([
  ...new Set([...ESTADOS_RESERVA_ACTIVOS, 'cancelada', 'finalizada']),
]);

const ESTADOS_PAGO_PERMITIDOS = Object.freeze([
  'sin_abonar',
  'senia',
  'senia_parcial',
  'senia_total',
  'seña',
  'seña_parcial',
  'seña_total',
  'abonada',
  'abonada_parcial',
  'abonada_total',
  'pagada',
  'pagada_parcial',
  'pagada_total',
]);

const esEstadoReservaActivo = (estado) => ESTADOS_RESERVA_ACTIVOS.includes(estado);

const esEstadoReservaValido = (estado) =>
  typeof estado === 'string' && ESTADOS_RESERVA_PERMITIDOS.includes(estado);

const esEstadoPagoValido = (estadoPago) =>
  typeof estadoPago === 'string' && ESTADOS_PAGO_PERMITIDOS.includes(estadoPago);

module.exports = {
  ESTADOS_RESERVA_ACTIVOS,
  ESTADOS_RESERVA_PERMITIDOS,
  ESTADOS_PAGO_PERMITIDOS,
  esEstadoReservaActivo,
  esEstadoReservaValido,
  esEstadoPagoValido,
};
