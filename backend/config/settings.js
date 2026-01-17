const DEFAULT_PRECIO_GRABACION = 3000;

const parseEnvNumber = (value, fallback, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${fieldName} debe ser un número positivo`);
  }

  return numeric;
};

const getPrecioGrabacionDefault = () =>
  parseEnvNumber(
    process.env.PRECIO_GRABACION_DEFAULT,
    DEFAULT_PRECIO_GRABACION,
    'PRECIO_GRABACION_DEFAULT'
  );

module.exports = {
  getPrecioGrabacionDefault,
};
