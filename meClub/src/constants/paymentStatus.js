export const PAYMENT_STATUS_DETAILS = {
  pendiente_pago: {
    label: 'Pendiente de pago',
    icon: 'remove-circle',
    iconColor: '#CBD5E1',
    backendValue: 'pendiente_pago',
    badge: {
      bg: 'bg-slate-500/20',
      border: 'border-slate-400/40',
      text: 'text-slate-100',
    },
  },
  senado: {
    label: 'Señado',
    icon: 'cash-outline',
    iconColor: '#38BDF8',
    backendValue: 'senado',
    badge: {
      bg: 'bg-sky-500/20',
      border: 'border-sky-400/40',
      text: 'text-sky-100',
    },
  },
  pagado: {
    label: 'Pagado',
    icon: 'checkmark-circle',
    iconColor: '#4ADE80',
    backendValue: 'pagado',
    badge: {
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-400/40',
      text: 'text-emerald-100',
    },
  },
  cancelado: {
    label: 'Cancelado',
    icon: 'close-circle',
    iconColor: '#F87171',
    backendValue: 'cancelado',
    badge: {
      bg: 'bg-rose-500/20',
      border: 'border-rose-400/40',
      text: 'text-rose-100',
    },
  },
};

export const PAYMENT_STATUS_ALIASES = {
  pendiente: 'pendiente_pago',
  'pendiente de pago': 'pendiente_pago',
  pendiente_pago: 'pendiente_pago',
  sin_abonar: 'pendiente_pago',
  'sin abonar': 'pendiente_pago',
  sin_pagar: 'pendiente_pago',
  senado: 'senado',
  'señado': 'senado',
  senia: 'senado',
  senia_parcial: 'senado',
  senia_total: 'senado',
  'seña': 'senado',
  pagada: 'pagado',
  pagado: 'pagado',
  pago: 'pagado',
  pagada_parcial: 'pagado',
  pago_parcial: 'pagado',
  pagada_total: 'pagado',
  abonada: 'pagado',
  abonado: 'pagado',
  abonada_parcial: 'pagado',
  abonado_parcial: 'pagado',
  abonada_total: 'pagado',
  abono: 'pagado',
  cancelada: 'cancelado',
  cancelado: 'cancelado',
  rechazado: 'cancelado',
};

export function normalizePaymentStatusValue(status) {
  if (!status) {
    return null;
  }
  const normalized = String(status).trim().toLowerCase();
  if (PAYMENT_STATUS_DETAILS[normalized]) {
    return normalized;
  }
  return PAYMENT_STATUS_ALIASES[normalized] || null;
}

export function getPaymentStatusDetails(status) {
  const resolved = normalizePaymentStatusValue(status);
  if (!resolved) {
    return null;
  }
  const detail = PAYMENT_STATUS_DETAILS[resolved];
  return detail ? { ...detail, value: resolved } : null;
}

export function getPaymentBackendValue(status) {
  const resolved = normalizePaymentStatusValue(status);
  if (!resolved) {
    return null;
  }
  const detail = PAYMENT_STATUS_DETAILS[resolved];
  if (!detail) {
    return null;
  }
  return detail.backendValue || resolved;
}

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_DETAILS).map(([value, detail]) => ({
  value,
  label: detail.label,
  icon: detail.icon,
}));
