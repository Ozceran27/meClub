const { CuponesModel } = require('../models/cupones.model');

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

const parseIntValue = (value, fieldName, { required = false, min = 0 } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throwValidationError(`${fieldName} es obligatorio`);
    return null;
  }
  const numeric = Number.parseInt(value, 10);
  if (!Number.isInteger(numeric) || numeric < min) {
    throwValidationError(`${fieldName} inválido`);
  }
  return numeric;
};

const listCupones = async (req, res) => {
  try {
    const cupones = await CuponesModel.listarPorClub(req.club.club_id);
    res.json({ club_id: req.club.club_id, cupones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const createCupon = async (req, res) => {
  try {
    const nombre = parseString(req.body?.nombre, 'nombre', { required: true, max: 120 });
    const usosPermitidos = parseIntValue(req.body?.usos_permitidos, 'usos_permitidos', {
      required: true,
      min: 1,
    });
    const tipoDescuento = parseDiscountType(req.body?.tipo_descuento);
    const valor = parseNumber(req.body?.valor, 'valor');
    const activo = req.body?.activo !== undefined ? Boolean(req.body?.activo) : true;

    const cupon = await CuponesModel.crear(req.club.club_id, {
      nombre,
      usos_permitidos: usosPermitidos,
      usos_realizados: 0,
      tipo_descuento: tipoDescuento,
      valor,
      activo,
    });

    res.status(201).json({ mensaje: 'Cupón creado', cupon });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const updateCupon = async (req, res) => {
  try {
    const cuponId = Number(req.params.cupon_id);
    if (!Number.isInteger(cuponId)) {
      return res.status(400).json({ mensaje: 'cupon_id inválido' });
    }

    const existente = await CuponesModel.obtenerPorId(cuponId, req.club.club_id);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Cupón no encontrado' });
    }

    const updates = {};

    if (req.body?.nombre !== undefined) {
      updates.nombre = parseString(req.body.nombre, 'nombre', { required: true, max: 120 });
    }

    if (req.body?.usos_permitidos !== undefined) {
      updates.usos_permitidos = parseIntValue(req.body.usos_permitidos, 'usos_permitidos', {
        required: true,
        min: 1,
      });
    }

    if (req.body?.tipo_descuento !== undefined) {
      updates.tipo_descuento = parseDiscountType(req.body.tipo_descuento);
    }

    if (req.body?.valor !== undefined) {
      updates.valor = parseNumber(req.body.valor, 'valor');
    }

    if (req.body?.activo !== undefined) {
      updates.activo = Boolean(req.body.activo);
    }

    if (updates.usos_permitidos !== undefined) {
      const usosPermitidos = updates.usos_permitidos;
      const usosRealizados = existente.usos_realizados ?? 0;
      if (usosRealizados >= usosPermitidos) {
        updates.activo = false;
      }
    }

    const cupon = await CuponesModel.actualizar(cuponId, req.club.club_id, updates);
    res.json({ mensaje: 'Cupón actualizado', cupon });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const deleteCupon = async (req, res) => {
  try {
    const cuponId = Number(req.params.cupon_id);
    if (!Number.isInteger(cuponId)) {
      return res.status(400).json({ mensaje: 'cupon_id inválido' });
    }

    const deleted = await CuponesModel.eliminar(cuponId, req.club.club_id);
    if (!deleted) {
      return res.status(404).json({ mensaje: 'Cupón no encontrado' });
    }

    res.json({ mensaje: 'Cupón eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const registerCuponUse = async (req, res) => {
  try {
    const cuponId = Number(req.params.cupon_id);
    if (!Number.isInteger(cuponId)) {
      return res.status(400).json({ mensaje: 'cupon_id inválido' });
    }

    const reservaId = req.body?.reserva_id ?? null;
    const usuarioId = req.body?.usuario_id ?? null;

    const cupon = await CuponesModel.registrarUso(cuponId, req.club.club_id, {
      reserva_id: reservaId,
      usuario_id: usuarioId,
    });

    if (!cupon) {
      return res.status(404).json({ mensaje: 'Cupón no encontrado' });
    }

    res.json({ mensaje: 'Uso registrado', cupon });
  } catch (err) {
    if (err.code === 'CUPON_BLOQUEADO') {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

module.exports = {
  listCupones,
  createCupon,
  updateCupon,
  deleteCupon,
  registerCuponUse,
};
