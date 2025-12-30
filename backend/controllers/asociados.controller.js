const TipoAsociadoModel = require('../models/tiposAsociado.model');
const AsociadosModel = require('../models/asociados.model');
const UsuariosModel = require('../models/usuarios.model');

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

const parseIntValue = (value, fieldName, { required = false, min = 0, max = 9999 } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throwValidationError(`${fieldName} es obligatorio`);
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throwValidationError(`${fieldName} inválido`);
  }
  return parsed;
};

const parseNumberValue = (value, fieldName, { required = false, min = 0 } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throwValidationError(`${fieldName} es obligatorio`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    throwValidationError(`${fieldName} inválido`);
  }
  return Math.round(parsed * 100) / 100;
};

const parseServicioIds = (value) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throwValidationError('servicios_incluidos debe ser un arreglo');
  }
  const ids = value
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0);
  return Array.from(new Set(ids));
};

const parsePagosRealizados = (value) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throwValidationError('pagos_realizados debe ser un arreglo');
  }
  return value
    .map((item) => {
      const date = new Date(item);
      return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    })
    .filter(Boolean);
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

const computeEstadoPago = (asociado) => {
  const fechaPago = Number.isInteger(asociado.fecha_pago) ? asociado.fecha_pago : 1;
  const diasGracia = Number.isInteger(asociado.dias_gracia) ? asociado.dias_gracia : 0;
  const pagos = Array.isArray(asociado.pagos_realizados) ? asociado.pagos_realizados : [];

  const parsedPagos = pagos
    .map((item) => parseDate(item))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastPayment = parsedPagos[0] || null;

  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const dueDay = Math.min(fechaPago, daysInMonth(year, monthIndex));
  const dueDate = new Date(year, monthIndex, dueDay);
  const graceDate = new Date(dueDate);
  graceDate.setDate(graceDate.getDate() + diasGracia);
  const startOfMonth = new Date(year, monthIndex, 1);

  if (lastPayment && lastPayment >= startOfMonth) {
    return 'pagado';
  }

  if (today <= graceDate) {
    return 'pendiente';
  }

  return 'vencido';
};

const listTipos = async (req, res) => {
  try {
    const tipos = await TipoAsociadoModel.listarPorClub(req.club.club_id);
    res.json({ tipos_asociado: tipos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const createTipo = async (req, res) => {
  try {
    const nombre = parseString(req.body?.nombre, 'nombre', { required: true, max: 120 });
    const cuota_mensual = parseNumberValue(req.body?.cuota_mensual, 'cuota_mensual', {
      required: true,
      min: 0,
    });
    const fecha_pago = parseIntValue(req.body?.fecha_pago, 'fecha_pago', {
      required: true,
      min: 1,
      max: 31,
    });
    const dias_gracia = parseIntValue(req.body?.dias_gracia, 'dias_gracia', {
      required: true,
      min: 0,
      max: 60,
    });
    const color = parseString(req.body?.color, 'color', { max: 32 }) || '#F97316';
    const servicios_incluidos = parseServicioIds(req.body?.servicios_incluidos);

    const tipo = await TipoAsociadoModel.crear(
      req.club.club_id,
      {
        nombre,
        cuota_mensual,
        fecha_pago,
        dias_gracia,
        color,
      },
      servicios_incluidos
    );

    res.status(201).json({ mensaje: 'Tipo de asociado creado', tipo_asociado: tipo });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const updateTipo = async (req, res) => {
  try {
    const tipoId = Number.parseInt(req.params.tipo_asociado_id, 10);
    if (!Number.isInteger(tipoId)) {
      return res.status(400).json({ mensaje: 'tipo_asociado_id inválido' });
    }

    const existente = await TipoAsociadoModel.obtenerPorId(tipoId, req.club.club_id);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Tipo de asociado no encontrado' });
    }

    const updates = {};
    if (req.body?.nombre !== undefined) {
      updates.nombre = parseString(req.body.nombre, 'nombre', { required: true, max: 120 });
    }
    if (req.body?.cuota_mensual !== undefined) {
      updates.cuota_mensual = parseNumberValue(req.body.cuota_mensual, 'cuota_mensual', {
        required: true,
        min: 0,
      });
    }
    if (req.body?.fecha_pago !== undefined) {
      updates.fecha_pago = parseIntValue(req.body.fecha_pago, 'fecha_pago', {
        required: true,
        min: 1,
        max: 31,
      });
    }
    if (req.body?.dias_gracia !== undefined) {
      updates.dias_gracia = parseIntValue(req.body.dias_gracia, 'dias_gracia', {
        required: true,
        min: 0,
        max: 60,
      });
    }
    if (req.body?.color !== undefined) {
      updates.color = parseString(req.body.color, 'color', { max: 32 }) || '#F97316';
    }

    const servicios_incluidos =
      req.body?.servicios_incluidos !== undefined
        ? parseServicioIds(req.body?.servicios_incluidos)
        : undefined;

    const tipo = await TipoAsociadoModel.actualizar(
      tipoId,
      req.club.club_id,
      updates,
      servicios_incluidos
    );

    res.json({ mensaje: 'Tipo de asociado actualizado', tipo_asociado: tipo });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const deleteTipo = async (req, res) => {
  try {
    const tipoId = Number.parseInt(req.params.tipo_asociado_id, 10);
    if (!Number.isInteger(tipoId)) {
      return res.status(400).json({ mensaje: 'tipo_asociado_id inválido' });
    }

    const eliminado = await TipoAsociadoModel.eliminar(tipoId, req.club.club_id);
    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Tipo de asociado no encontrado' });
    }

    res.json({ mensaje: 'Tipo de asociado eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const listAsociados = async (req, res) => {
  try {
    const asociados = await AsociadosModel.listarPorClub(req.club.club_id);
    const payload = asociados.map((asociado) => ({
      ...asociado,
      estado_pago: computeEstadoPago(asociado),
    }));
    res.json({ asociados: payload });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const createAsociado = async (req, res) => {
  try {
    const tipo_asociado_id = parseIntValue(req.body?.tipo_asociado_id, 'tipo_asociado_id', {
      required: true,
      min: 1,
      max: 999999,
    });

    const usuarioId = req.body?.usuario_id ? parseIntValue(req.body.usuario_id, 'usuario_id', {
      required: false,
      min: 1,
      max: 999999999,
    }) : null;

    let usuario = null;
    if (usuarioId) {
      usuario = await UsuariosModel.buscarPorId(usuarioId);
      if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
    }

    const nombre =
      parseString(req.body?.nombre, 'nombre', { required: !usuario, max: 120 }) ||
      usuario?.nombre ||
      null;
    const apellido =
      parseString(req.body?.apellido, 'apellido', { required: !usuario, max: 120 }) ||
      usuario?.apellido ||
      null;
    const telefono =
      parseString(req.body?.telefono, 'telefono', { required: true, max: 40 }) ||
      usuario?.telefono ||
      null;
    const dni = parseString(req.body?.dni, 'dni', { max: 40 });
    const direccion = parseString(req.body?.direccion, 'direccion', { max: 200 });
    const correo =
      parseString(req.body?.correo, 'correo', { max: 200 }) || usuario?.email || null;

    const pagos_realizados = parsePagosRealizados(req.body?.pagos_realizados);
    const fecha_inscripcion =
      parseString(req.body?.fecha_inscripcion, 'fecha_inscripcion', { max: 20 }) ||
      new Date().toISOString().slice(0, 10);

    const asociado = await AsociadosModel.crear(req.club.club_id, {
      tipo_asociado_id,
      usuario_id: usuarioId,
      nombre,
      apellido,
      dni,
      telefono,
      direccion,
      correo,
      pagos_realizados: JSON.stringify(pagos_realizados),
      fecha_inscripcion,
    });

    res.status(201).json({
      mensaje: 'Asociado creado',
      asociado: {
        ...asociado,
        estado_pago: computeEstadoPago(asociado),
      },
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const deleteAsociado = async (req, res) => {
  try {
    const asociadoId = Number.parseInt(req.params.asociado_id, 10);
    if (!Number.isInteger(asociadoId)) {
      return res.status(400).json({ mensaje: 'asociado_id inválido' });
    }

    const eliminado = await AsociadosModel.eliminar(asociadoId, req.club.club_id);
    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Asociado no encontrado' });
    }

    res.json({ mensaje: 'Asociado eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

module.exports = {
  listTipos,
  createTipo,
  updateTipo,
  deleteTipo,
  listAsociados,
  createAsociado,
  deleteAsociado,
};
