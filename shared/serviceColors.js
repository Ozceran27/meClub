const SERVICE_COLORS = [
  '#4C5A92',
  '#2F6F5B',
  '#9A6A3B',
  '#8A3B5C',
  '#6A4C9B',
  '#2B6C6A',
  '#8B3A3A',
  '#3A6B78',
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
