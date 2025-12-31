const SERVICE_COLORS = [
  '#1E3A8A',
  '#047857',
  '#B45309',
  '#9F1239',
  '#6D28D9',
  '#0F766E',
  '#B91C1C',
  '#0E7490',
];

const normalizeHexColor = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase();
  if (!/^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(normalized)) return null;
  return normalized;
};

const isValidHexColor = (value) => Boolean(normalizeHexColor(value));

module.exports = {
  SERVICE_COLORS,
  normalizeHexColor,
  isValidHexColor,
};
