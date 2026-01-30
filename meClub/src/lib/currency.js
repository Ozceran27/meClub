export const normalizeCurrencyInput = (value) => String(value ?? '').replace(/\D/g, '');

export const parseCurrencyInput = (value) => {
  const digits = normalizeCurrencyInput(value);
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatCurrencyValue = (value) => {
  const digits = normalizeCurrencyInput(value);
  if (!digits) return '';
  const numeric = Number(digits);
  if (!Number.isFinite(numeric)) return '';
  return `$ ${numeric.toLocaleString('es-AR')}`;
};

export const formatCurrencyInput = (value) => formatCurrencyValue(value);
