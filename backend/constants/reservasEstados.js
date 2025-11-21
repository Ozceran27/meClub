const ESTADOS_RESERVA_ACTIVOS = Object.freeze(['pendiente', 'confirmada', 'pagada']);

const ESTADOS_RESERVA_PERMITIDOS = Object.freeze([
  ...new Set([...ESTADOS_RESERVA_ACTIVOS, 'cancelada', 'finalizada']),
]);

const ESTADOS_PAGO_PERMITIDOS = Object.freeze([
  'pendiente_pago',
  'senado',
  'pagado',
  'cancelado',
]);

const ESTADOS_PAGO_ALIAS = {
  pendiente: 'pendiente_pago',
  'pendiente de pago': 'pendiente_pago',
  pendiente_pago: 'pendiente_pago',
  sin_abonar: 'pendiente_pago',
  'sin abonar': 'pendiente_pago',
  sin_pagar: 'pendiente_pago',
  senado: 'senado',
  senia: 'senado',
  seña: 'senado',
  senia_parcial: 'senado',
  senia_total: 'senado',
  seña_parcial: 'senado',
  seña_total: 'senado',
  pagado: 'pagado',
  pagada: 'pagado',
  pagada_parcial: 'pagado',
  pagada_total: 'pagado',
  pago: 'pagado',
  pago_parcial: 'pagado',
  abonada: 'pagado',
  abonado: 'pagado',
  abonada_parcial: 'pagado',
  abonado_parcial: 'pagado',
  abonada_total: 'pagado',
  abono: 'pagado',
  cancelado: 'cancelado',
  cancelada: 'cancelado',
  rechazado: 'cancelado',
};

const esEstadoReservaActivo = (estado) => ESTADOS_RESERVA_ACTIVOS.includes(estado);

const esEstadoReservaValido = (estado) =>
  typeof estado === 'string' && ESTADOS_RESERVA_PERMITIDOS.includes(estado);

const normalizarEstadoPago = (estadoPago) => {
  if (estadoPago === undefined || estadoPago === null) return null;
  const raw = typeof estadoPago === 'string' ? estadoPago : String(estadoPago);
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  return ESTADOS_PAGO_ALIAS[normalized] || (ESTADOS_PAGO_PERMITIDOS.includes(normalized) ? normalized : null);
};

const esEstadoPagoValido = (estadoPago) => Boolean(normalizarEstadoPago(estadoPago));

module.exports = {
  ESTADOS_RESERVA_ACTIVOS,
  ESTADOS_RESERVA_PERMITIDOS,
  ESTADOS_PAGO_PERMITIDOS,
  ESTADOS_PAGO_ALIAS,
  esEstadoReservaActivo,
  esEstadoReservaValido,
  esEstadoPagoValido,
  normalizarEstadoPago,
};
