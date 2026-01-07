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

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

const calculateMonthsElapsed = (fechaInscripcion) => {
  const startDate = parseDate(fechaInscripcion);
  if (!startDate) return 0;
  const today = new Date();
  let months =
    (today.getFullYear() - startDate.getFullYear()) * 12 +
    (today.getMonth() - startDate.getMonth());
  if (today.getDate() >= startDate.getDate()) {
    months += 1;
  }
  return Math.max(months, 0);
};

const calculateDebt = (asociado) => {
  const cuota = Number(asociado.cuota_mensual) || 0;
  const pagos = Number(asociado.pagos_realizados) || 0;
  const meses_transcurridos = calculateMonthsElapsed(asociado.fecha_inscripcion);
  const deuda = Math.round((cuota * meses_transcurridos - pagos) * 100) / 100;
  return { deuda, meses_transcurridos };
};

const ESTADO_PAGO_VALUES = ['pagado', 'pendiente', 'vencido'];

const computeEstadoPago = (asociado) => {
  const manual = typeof asociado.estado_pago_manual === 'string'
    ? asociado.estado_pago_manual.trim().toLowerCase()
    : '';
  if (ESTADO_PAGO_VALUES.includes(manual)) {
    return manual;
  }
  const fechaPago = Number.isInteger(asociado.fecha_pago) ? asociado.fecha_pago : 1;
  const diasGracia = Number.isInteger(asociado.dias_gracia) ? asociado.dias_gracia : 0;
  const { deuda } = calculateDebt(asociado);

  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const dueDay = Math.min(fechaPago, daysInMonth(year, monthIndex));
  const dueDate = new Date(year, monthIndex, dueDay);
  const graceDate = new Date(dueDate);
  graceDate.setDate(graceDate.getDate() + diasGracia);
  if (deuda <= 0) {
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
      ...calculateDebt(asociado),
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

    const pagos_realizados =
      req.body?.pagos_realizados !== undefined
        ? parseNumberValue(req.body?.pagos_realizados, 'pagos_realizados', { min: 0 }) ?? 0
        : 0;
    const fecha_inscripcion = new Date().toISOString().slice(0, 10);

    const asociado = await AsociadosModel.crear(req.club.club_id, {
      tipo_asociado_id,
      usuario_id: usuarioId,
      nombre,
      apellido,
      dni,
      telefono,
      direccion,
      correo,
      pagos_realizados,
      fecha_inscripcion,
    });

    res.status(201).json({
      mensaje: 'Asociado creado',
      asociado: {
        ...asociado,
        ...calculateDebt(asociado),
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

const searchAsociados = async (req, res) => {
  try {
    const queryValue = req.query?.query ?? req.query?.q;
    const query = parseString(queryValue, 'query', { required: true, max: 120 });
    const limit = parseIntValue(req.query?.limit, 'limit', { min: 1, max: 50 }) || 20;
    const asociados = await AsociadosModel.buscarPorQuery(req.club.club_id, query, limit);
    const payload = asociados.map((asociado) => ({
      ...asociado,
      ...calculateDebt(asociado),
      estado_pago: computeEstadoPago(asociado),
    }));
    res.json({ asociados: payload });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const registerPago = async (req, res) => {
  try {
    const asociadoId = Number.parseInt(req.params.asociado_id, 10);
    if (!Number.isInteger(asociadoId)) {
      return res.status(400).json({ mensaje: 'asociado_id inválido' });
    }

    const monto = parseNumberValue(req.body?.monto, 'monto', { required: true, min: 0.01 });
    const fecha_pago =
      parseString(req.body?.fecha_pago, 'fecha_pago', { max: 20 }) ||
      new Date().toISOString().slice(0, 10);

    const asociado = await AsociadosModel.obtenerPorId(asociadoId, req.club.club_id);
    if (!asociado) {
      return res.status(404).json({ mensaje: 'Asociado no encontrado' });
    }

    const pagosActuales = Number(asociado.pagos_realizados) || 0;
    const pagos_realizados = Math.round((pagosActuales + monto) * 100) / 100;

    const actualizado = await AsociadosModel.actualizarPagosRealizados(
      asociadoId,
      req.club.club_id,
      pagos_realizados
    );

    try {
      const PagosAsociadosModel = require('../models/pagosAsociados.model');
      await PagosAsociadosModel.registrarPago({
        asociado_id: asociadoId,
        club_id: req.club.club_id,
        monto,
        fecha_pago,
      });
    } catch (error) {
      console.warn('No se pudo registrar el pago en la tabla de pagos:', error.message);
    }

    res.json({
      mensaje: 'Pago registrado',
      asociado: {
        ...actualizado,
        ...calculateDebt(actualizado),
        estado_pago: computeEstadoPago(actualizado),
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

const updateEstadoAsociado = async (req, res) => {
  try {
    const asociadoId = Number.parseInt(req.params.asociado_id, 10);
    if (!Number.isInteger(asociadoId)) {
      return res.status(400).json({ mensaje: 'asociado_id inválido' });
    }

    const estado = parseString(req.body?.estado_pago ?? req.body?.estado, 'estado_pago', {
      required: true,
      max: 20,
    })
      .toLowerCase();

    if (!ESTADO_PAGO_VALUES.includes(estado)) {
      return res.status(400).json({ mensaje: 'estado_pago inválido' });
    }

    const asociado = await AsociadosModel.obtenerPorId(asociadoId, req.club.club_id);
    if (!asociado) {
      return res.status(404).json({ mensaje: 'Asociado no encontrado' });
    }

    const actualizado = await AsociadosModel.actualizarEstadoPagoManual(
      asociadoId,
      req.club.club_id,
      estado
    );

    res.json({
      mensaje: 'Estado actualizado',
      asociado: {
        ...actualizado,
        ...calculateDebt(actualizado),
        estado_pago: computeEstadoPago(actualizado),
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

module.exports = {
  listTipos,
  createTipo,
  updateTipo,
  deleteTipo,
  listAsociados,
  createAsociado,
  deleteAsociado,
  searchAsociados,
  registerPago,
  updateEstadoAsociado,
};
