const { PromocionesModel, parseCanchasAplicadas } = require('../models/promociones.model');

const TIPOS_DESCUENTO = new Set(['porcentaje', 'nominal']);

const throwValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

const parseString = (value, fieldName, { required = false, max = 120 } = {}) => {
  if (value === undefined || value === null) {
    if (required) throwValidationError(`${fieldName} es obligatorio`);
    return null;
  }
  if (typeof value !== 'string') {
    throwValidationError(`${fieldName} debe ser una cadena`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) throwValidationError(`${fieldName} es obligatorio`);
    return null;
  }
  return trimmed.slice(0, max);
};

const parseDiscountType = (value) => {
  if (value === undefined || value === null || value === '') {
    throwValidationError('tipo_descuento es obligatorio');
  }
  const normalized = String(value).trim();
  if (!TIPOS_DESCUENTO.has(normalized)) {
    throwValidationError('tipo_descuento inválido');
  }
  return normalized;
};

const parseNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    throwValidationError(`${fieldName} es obligatorio`);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throwValidationError(`${fieldName} debe ser un número positivo`);
  }
  return Math.round(numeric * 100) / 100;
};

const parseDateTime = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throwValidationError(`${fieldName} es obligatorio`);
    return null;
  }
  const raw = String(value).trim();
  if (!raw) {
    if (required) throwValidationError(`${fieldName} es obligatorio`);
    return null;
  }
  const candidate = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throwValidationError(`${fieldName} inválida`);
  }
  const pad = (val) => String(val).padStart(2, '0');
  const formatted = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(
    parsed.getHours()
  )}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
  return { value: formatted, date: parsed };
};

const parseCanchas = (value) => {
  if (value === undefined) return undefined;
  const parsed = parseCanchasAplicadas(value);
  return JSON.stringify(parsed);
};

const listPromociones = async (req, res) => {
  try {
    const promociones = await PromocionesModel.listarPorClub(req.club.club_id);
    res.json({ club_id: req.club.club_id, promociones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const createPromocion = async (req, res) => {
  try {
    const nombre = parseString(req.body?.nombre, 'nombre', { required: true, max: 120 });
    const fechaInicio = parseDateTime(req.body?.fecha_inicio, 'fecha_inicio', { required: true });
    const fechaFin = parseDateTime(req.body?.fecha_fin, 'fecha_fin', { required: true });

    if (fechaInicio.date >= fechaFin.date) {
      throwValidationError('fecha_fin debe ser posterior a fecha_inicio');
    }

    const tipoDescuento = parseDiscountType(req.body?.tipo_descuento);
    const valor = parseNumber(req.body?.valor, 'valor');
    const canchasAplicadas = parseCanchas(req.body?.canchas_aplicadas ?? []);
    const activo = req.body?.activo !== undefined ? Boolean(req.body?.activo) : true;

    const promocion = await PromocionesModel.crear(req.club.club_id, {
      nombre,
      fecha_inicio: fechaInicio.value,
      fecha_fin: fechaFin.value,
      tipo_descuento: tipoDescuento,
      valor,
      canchas_aplicadas: canchasAplicadas,
      activo,
    });

    res.status(201).json({ mensaje: 'Promoción creada', promocion });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const updatePromocion = async (req, res) => {
  try {
    const promocionId = Number(req.params.promocion_id);
    if (!Number.isInteger(promocionId)) {
      return res.status(400).json({ mensaje: 'promocion_id inválido' });
    }

    const existente = await PromocionesModel.obtenerPorId(promocionId, req.club.club_id);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Promoción no encontrada' });
    }

    const updates = {};

    if (req.body?.nombre !== undefined) {
      updates.nombre = parseString(req.body.nombre, 'nombre', { required: true, max: 120 });
    }

    let fechaInicio = null;
    let fechaFin = null;
    if (req.body?.fecha_inicio !== undefined) {
      fechaInicio = parseDateTime(req.body.fecha_inicio, 'fecha_inicio', { required: true });
      updates.fecha_inicio = fechaInicio.value;
    }
    if (req.body?.fecha_fin !== undefined) {
      fechaFin = parseDateTime(req.body.fecha_fin, 'fecha_fin', { required: true });
      updates.fecha_fin = fechaFin.value;
    }

    const startDate = fechaInicio?.date || new Date(existente.fecha_inicio);
    const endDate = fechaFin?.date || new Date(existente.fecha_fin);
    if (startDate && endDate && startDate >= endDate) {
      throwValidationError('fecha_fin debe ser posterior a fecha_inicio');
    }

    if (req.body?.tipo_descuento !== undefined) {
      updates.tipo_descuento = parseDiscountType(req.body.tipo_descuento);
    }

    if (req.body?.valor !== undefined) {
      updates.valor = parseNumber(req.body.valor, 'valor');
    }

    if (req.body?.canchas_aplicadas !== undefined) {
      updates.canchas_aplicadas = parseCanchas(req.body.canchas_aplicadas);
    }

    if (req.body?.activo !== undefined) {
      updates.activo = Boolean(req.body.activo);
    }

    const promocion = await PromocionesModel.actualizar(promocionId, req.club.club_id, updates);
    res.json({ mensaje: 'Promoción actualizada', promocion });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const deletePromocion = async (req, res) => {
  try {
    const promocionId = Number(req.params.promocion_id);
    if (!Number.isInteger(promocionId)) {
      return res.status(400).json({ mensaje: 'promocion_id inválido' });
    }

    const deleted = await PromocionesModel.eliminar(promocionId, req.club.club_id);
    if (!deleted) {
      return res.status(404).json({ mensaje: 'Promoción no encontrada' });
    }

    res.json({ mensaje: 'Promoción eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

module.exports = {
  listPromociones,
  createPromocion,
  updatePromocion,
  deletePromocion,
};
