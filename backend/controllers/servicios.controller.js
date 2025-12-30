const ClubServiciosModel = require('../models/clubServicios.model');
const { normalizeHour } = require('../utils/datetime');

const MODOS_ACCESO = new Set(['libre', 'reserva', 'solo_socios', 'requiere_reserva']);
const AMBIENTES = new Set(['aire_libre', 'cerrado']);
const PRECIO_TIPOS = new Set(['hora', 'dia']);

const throwValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

const parseString = (value, fieldName, { required = false, max = 255 } = {}) => {
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

const parseEnum = (value, fieldName, allowed) => {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (!allowed.has(normalized)) {
    throwValidationError(`${fieldName} inválido`);
  }
  return normalized;
};

const normalizeModoAcceso = (value) => {
  if (value === 'requiere_reserva') return 'reserva';
  return value;
};

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  return Boolean(value);
};

const parseDiasDisponibles = (value) => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throwValidationError('dias_disponibles debe ser un arreglo');
  }

  const normalizados = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);

  const unique = Array.from(new Set(normalizados));
  return JSON.stringify(unique);
};

const parsePriceValue = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throwValidationError('precio_valor debe ser un número positivo');
  }
  return Math.round(numeric * 100) / 100;
};

const parseHourValue = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const normalized = normalizeHour(String(value));
  if (!normalized) {
    throwValidationError(`${fieldName} inválida`);
  }
  return normalized;
};

const ensurePrecioReglas = ({ modoAcceso, precioTipo, precioValor, forceNull = false }) => {
  if (modoAcceso === 'reserva') {
    if (!precioTipo) {
      throwValidationError('precio_tipo es obligatorio cuando modo_acceso requiere reserva');
    }
    if (precioValor === null || precioValor === undefined) {
      throwValidationError('precio_valor es obligatorio cuando modo_acceso requiere reserva');
    }
    return { precioTipo, precioValor };
  }

  if (forceNull) {
    return { precioTipo: null, precioValor: null };
  }

  if (precioTipo !== undefined || precioValor !== undefined) {
    throwValidationError('precio solo aplica cuando modo_acceso requiere reserva');
  }

  return { precioTipo, precioValor };
};

const listServicios = async (req, res) => {
  try {
    const servicios = await ClubServiciosModel.listarPorClub(req.club.club_id);
    res.json({ club_id: req.club.club_id, servicios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const createServicio = async (req, res) => {
  try {
    const nombre = parseString(req.body?.nombre, 'nombre', { required: true, max: 120 });
    let modoAcceso = parseEnum(req.body?.modo_acceso, 'modo_acceso', MODOS_ACCESO) || 'libre';
    modoAcceso = normalizeModoAcceso(modoAcceso);

    const diasDisponibles = parseDiasDisponibles(req.body?.dias_disponibles);
    const horaInicio = parseHourValue(req.body?.hora_inicio, 'hora_inicio');
    const horaFin = parseHourValue(req.body?.hora_fin, 'hora_fin');

    if ((horaInicio && !horaFin) || (!horaInicio && horaFin)) {
      throwValidationError('Debe indicar hora_inicio y hora_fin');
    }

    const imagenUrl = parseString(req.body?.imagen_url, 'imagen_url');
    const ambiente = parseEnum(req.body?.ambiente, 'ambiente', AMBIENTES);
    const precioTipo = parseEnum(req.body?.precio_tipo, 'precio_tipo', PRECIO_TIPOS);
    const precioValor = parsePriceValue(req.body?.precio_valor);

    const { precioTipo: precioTipoFinal, precioValor: precioValorFinal } = ensurePrecioReglas({
      modoAcceso,
      precioTipo,
      precioValor,
    });

    const payload = {
      nombre,
      modo_acceso: modoAcceso,
      dias_disponibles: diasDisponibles,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      imagen_url: imagenUrl,
      ambiente,
      precio_tipo: precioTipoFinal,
      precio_valor: precioValorFinal,
      no_fumar: Boolean(req.body?.no_fumar),
      mas_18: Boolean(req.body?.mas_18),
      comida: Boolean(req.body?.comida),
      eco_friendly: Boolean(req.body?.eco_friendly),
      activo: req.body?.activo !== undefined ? Boolean(req.body?.activo) : true,
    };

    const servicio = await ClubServiciosModel.crear(req.club.club_id, payload);
    res.status(201).json({ mensaje: 'Servicio creado', servicio });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const updateServicio = async (req, res) => {
  try {
    const servicioId = Number(req.params.servicio_id);
    if (!Number.isInteger(servicioId)) {
      return res.status(400).json({ mensaje: 'servicio_id inválido' });
    }

    const existente = await ClubServiciosModel.obtenerPorId(servicioId, req.club.club_id);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Servicio no encontrado' });
    }

    const updates = {};

    if (req.body?.nombre !== undefined) {
      updates.nombre = parseString(req.body.nombre, 'nombre', { required: true, max: 120 });
    }

    if (req.body?.modo_acceso !== undefined) {
      const modo = parseEnum(req.body.modo_acceso, 'modo_acceso', MODOS_ACCESO);
      updates.modo_acceso = normalizeModoAcceso(modo);
    }

    if (req.body?.dias_disponibles !== undefined) {
      updates.dias_disponibles = parseDiasDisponibles(req.body.dias_disponibles);
    }

    if (req.body?.hora_inicio !== undefined) {
      updates.hora_inicio = parseHourValue(req.body.hora_inicio, 'hora_inicio');
    }

    if (req.body?.hora_fin !== undefined) {
      updates.hora_fin = parseHourValue(req.body.hora_fin, 'hora_fin');
    }

    if (
      (updates.hora_inicio !== undefined || updates.hora_fin !== undefined) &&
      ((updates.hora_inicio ?? existente.hora_inicio) && !(updates.hora_fin ?? existente.hora_fin))
    ) {
      throwValidationError('Debe indicar hora_inicio y hora_fin');
    }

    if (req.body?.imagen_url !== undefined) {
      updates.imagen_url = parseString(req.body.imagen_url, 'imagen_url');
    }

    if (req.body?.ambiente !== undefined) {
      updates.ambiente = parseEnum(req.body.ambiente, 'ambiente', AMBIENTES);
    }

    if (req.body?.precio_tipo !== undefined) {
      updates.precio_tipo = parseEnum(req.body.precio_tipo, 'precio_tipo', PRECIO_TIPOS);
    }

    if (req.body?.precio_valor !== undefined) {
      updates.precio_valor = parsePriceValue(req.body.precio_valor);
    }

    if (req.body?.no_fumar !== undefined) updates.no_fumar = parseBoolean(req.body.no_fumar);
    if (req.body?.mas_18 !== undefined) updates.mas_18 = parseBoolean(req.body.mas_18);
    if (req.body?.comida !== undefined) updates.comida = parseBoolean(req.body.comida);
    if (req.body?.eco_friendly !== undefined) updates.eco_friendly = parseBoolean(req.body.eco_friendly);
    if (req.body?.activo !== undefined) updates.activo = parseBoolean(req.body.activo);

    const modoAccesoFinal = updates.modo_acceso ?? existente.modo_acceso;
    const precioTipoFinal = updates.precio_tipo ?? existente.precio_tipo;
    const precioValorFinal = updates.precio_valor ?? existente.precio_valor;

    if (modoAccesoFinal === 'reserva') {
      ensurePrecioReglas({
        modoAcceso: modoAccesoFinal,
        precioTipo: precioTipoFinal,
        precioValor: precioValorFinal,
      });
    } else if (updates.modo_acceso && updates.modo_acceso !== 'reserva') {
      const reset = ensurePrecioReglas({
        modoAcceso: modoAccesoFinal,
        precioTipo: updates.precio_tipo,
        precioValor: updates.precio_valor,
        forceNull: true,
      });
      updates.precio_tipo = reset.precioTipo;
      updates.precio_valor = reset.precioValor;
    } else if (updates.precio_tipo !== undefined || updates.precio_valor !== undefined) {
      ensurePrecioReglas({
        modoAcceso: modoAccesoFinal,
        precioTipo: updates.precio_tipo,
        precioValor: updates.precio_valor,
      });
    }

    const servicio = await ClubServiciosModel.actualizar(servicioId, req.club.club_id, updates);
    res.json({ mensaje: 'Servicio actualizado', servicio });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const deleteServicio = async (req, res) => {
  try {
    const servicioId = Number(req.params.servicio_id);
    if (!Number.isInteger(servicioId)) {
      return res.status(400).json({ mensaje: 'servicio_id inválido' });
    }

    const eliminado = await ClubServiciosModel.eliminar(servicioId, req.club.club_id);
    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Servicio no encontrado' });
    }

    res.json({ mensaje: 'Servicio eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

module.exports = {
  listServicios,
  createServicio,
  updateServicio,
  deleteServicio,
};
