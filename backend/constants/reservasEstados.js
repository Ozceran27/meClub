const ESTADOS_RESERVA_ACTIVOS = Object.freeze(['pendiente', 'confirmada', 'pagada']);

const ESTADOS_RESERVA_PERMITIDOS = Object.freeze([
  ...new Set([...ESTADOS_RESERVA_ACTIVOS, 'cancelada', 'finalizada']),
]);

const ESTADOS_PAGO_PERMITIDOS = Object.freeze(['pendiente', 'senia', 'abonado', 'rechazado']);

const ESTADOS_PAGO_ALIASES = Object.freeze({
  pendiente: 'pendiente',
  sin_abonar: 'pendiente',
  sin_pagar: 'pendiente',
  no_pagado: 'pendiente',

  senia: 'senia',
  'seña': 'senia',
  senia_parcial: 'senia',
  senia_total: 'senia',
  'seña_parcial': 'senia',
  'seña_total': 'senia',

  abonado: 'abonado',
  abonada: 'abonado',
  abonada_parcial: 'abonado',
  abonada_total: 'abonado',
  pagado: 'abonado',
  pagada: 'abonado',
  pagada_parcial: 'abonado',
  pagada_total: 'abonado',

  rechazado: 'rechazado',
  rechazada: 'rechazado',
});

const esEstadoReservaActivo = (estado) => ESTADOS_RESERVA_ACTIVOS.includes(estado);

const esEstadoReservaValido = (estado) =>
  typeof estado === 'string' && ESTADOS_RESERVA_PERMITIDOS.includes(estado);

const esEstadoPagoValido = (estadoPago) =>
  typeof estadoPago === 'string' && ESTADOS_PAGO_PERMITIDOS.includes(estadoPago);

const normalizarEstadoPago = (valor) => {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const texto = typeof valor === 'string' ? valor.trim().toLowerCase() : String(valor).trim().toLowerCase();
  if (!texto) return null;
  return ESTADOS_PAGO_ALIASES[texto] || (esEstadoPagoValido(texto) ? texto : undefined);
};

module.exports = {
  ESTADOS_RESERVA_ACTIVOS,
  ESTADOS_RESERVA_PERMITIDOS,
  ESTADOS_PAGO_PERMITIDOS,
  ESTADOS_PAGO_ALIASES,
  esEstadoReservaActivo,
  esEstadoReservaValido,
  esEstadoPagoValido,
  normalizarEstadoPago,
};
