const EventosModel = require('../models/eventos.model');
const EventoEquiposModel = require('../models/evento_equipos.model');
const {
  getLimitePorTipo,
  validateClubPermisoTipo,
  validateEstado,
  validateLimiteEquipos,
  validateTipo,
  resolveRegionalProvincia,
  isZonaRegional,
} = require('../utils/eventosRules');

const throwValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const parseRequiredString = (value, fieldName) => {
  if (typeof value !== 'string') {
    throwValidationError(`${fieldName} es obligatorio`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throwValidationError(`${fieldName} es obligatorio`);
  }
  return trimmed;
};

const parseOptionalString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throwValidationError('valor inválido');
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const parseOptionalDate = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throwValidationError(`${fieldName} inválido`);
  }
  return parsed;
};

const parseOptionalInteger = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throwValidationError(`${fieldName} inválido`);
  }
  return parsed;
};

const resolveLimiteEvento = (evento) => {
  if (!evento) return null;
  if (evento.limite_equipos) return Number(evento.limite_equipos);
  return getLimitePorTipo(evento.tipo);
};

const listEventos = async (req, res) => {
  try {
    const zonaRegional = isZonaRegional(req.query?.zona, req.query?.zona_regional);
    const provinciaId = zonaRegional ? req.club.provincia_id : undefined;
    const eventos = await EventosModel.listarPorClub(req.club.club_id, { provinciaId });
    res.json({ eventos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const getEvento = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }
    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    res.json({ evento });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const createEvento = async (req, res) => {
  try {
    const nombre = parseRequiredString(req.body?.nombre, 'nombre');
    const tipo = validateTipo(req.body?.tipo);
    if (!tipo) {
      throwValidationError('tipo es obligatorio');
    }
    validateClubPermisoTipo(tipo, req.club);

    const estado = validateEstado(req.body?.estado) || 'inactivo';
    const descripcion = parseOptionalString(req.body?.descripcion);
    const fecha_inicio = parseOptionalDate(req.body?.fecha_inicio, 'fecha_inicio');
    const fecha_fin = parseOptionalDate(req.body?.fecha_fin, 'fecha_fin');
    const zona = parseOptionalString(req.body?.zona) || null;
    const provincia_id = resolveRegionalProvincia(req.body || {}, req.club);
    const limite_equipos = validateLimiteEquipos(tipo, req.body?.limite_equipos);

    const evento = await EventosModel.crear(req.club.club_id, {
      nombre,
      tipo,
      descripcion,
      estado,
      fecha_inicio,
      fecha_fin,
      zona,
      provincia_id,
      limite_equipos,
    });

    res.status(201).json({ mensaje: 'Evento creado', evento });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const updateEvento = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const existente = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    if (req.body?.estado !== undefined && existente.estado !== 'inactivo') {
      throwValidationError('estado solo editable cuando el evento está inactivo');
    }

    const updates = {};

    if (req.body?.nombre !== undefined) {
      updates.nombre = parseRequiredString(req.body.nombre, 'nombre');
    }

    if (req.body?.tipo !== undefined) {
      const tipo = validateTipo(req.body.tipo);
      if (!tipo) {
        throwValidationError('tipo inválido');
      }
      validateClubPermisoTipo(tipo, req.club);
      updates.tipo = tipo;
    }

    if (req.body?.descripcion !== undefined) {
      updates.descripcion = parseOptionalString(req.body.descripcion);
    }

    if (req.body?.fecha_inicio !== undefined) {
      updates.fecha_inicio = parseOptionalDate(req.body.fecha_inicio, 'fecha_inicio');
    }

    if (req.body?.fecha_fin !== undefined) {
      updates.fecha_fin = parseOptionalDate(req.body.fecha_fin, 'fecha_fin');
    }

    if (req.body?.estado !== undefined) {
      updates.estado = validateEstado(req.body.estado);
    }

    const zonaProvided = req.body?.zona !== undefined || req.body?.zona_regional !== undefined;
    const provinciaProvided = req.body?.provincia_id !== undefined;
    if (zonaProvided || provinciaProvided) {
      const zonaValue = req.body?.zona !== undefined ? parseOptionalString(req.body.zona) : existente.zona;
      if (req.body?.zona_regional !== undefined && zonaValue === null) {
        updates.zona = req.body.zona_regional ? 'regional' : zonaValue;
      } else if (req.body?.zona !== undefined) {
        updates.zona = zonaValue;
      }
      updates.provincia_id = resolveRegionalProvincia(
        {
          zona: zonaValue ?? existente.zona,
          zona_regional: req.body?.zona_regional,
          provincia_id: req.body?.provincia_id ?? existente.provincia_id,
        },
        req.club
      );
    }

    if (req.body?.limite_equipos !== undefined) {
      const tipoForLimit = updates.tipo || existente.tipo;
      updates.limite_equipos = validateLimiteEquipos(tipoForLimit, req.body.limite_equipos);
    }

    const evento = await EventosModel.actualizar(eventoId, req.club.club_id, updates);
    res.json({ mensaje: 'Evento actualizado', evento });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const deleteEvento = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const deleted = await EventosModel.eliminar(eventoId, req.club.club_id);
    if (!deleted) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    res.json({ mensaje: 'Evento eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const setEstadoEvento = async (req, res, nextEstado, allowedEstados) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    if (!allowedEstados.includes(evento.estado)) {
      return res.status(400).json({ mensaje: 'Transición de estado no permitida' });
    }

    const actualizado = await EventosModel.actualizar(eventoId, req.club.club_id, {
      estado: nextEstado,
    });
    res.json({ mensaje: `Evento ${nextEstado}`, evento: actualizado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const iniciarEvento = (req, res) =>
  setEstadoEvento(req, res, 'activo', ['inactivo', 'pausado']);

const pausarEvento = (req, res) =>
  setEstadoEvento(req, res, 'pausado', ['activo']);

const finalizarEvento = (req, res) =>
  setEstadoEvento(req, res, 'finalizado', ['inactivo', 'activo', 'pausado']);

const inscribirEquipo = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    if (evento.estado === 'finalizado') {
      return res.status(400).json({ mensaje: 'No se pueden inscribir equipos en un evento finalizado' });
    }

    const equipoId = parseOptionalInteger(req.body?.equipo_id, 'equipo_id');
    if (!equipoId) {
      throwValidationError('equipo_id es obligatorio');
    }
    const nombreEquipo = parseOptionalString(req.body?.nombre_equipo);

    const existente = await EventoEquiposModel.obtenerPorEquipo(eventoId, equipoId);
    if (existente) {
      return res.status(409).json({ mensaje: 'El equipo ya está inscripto en este evento' });
    }

    const limite = resolveLimiteEvento(evento);
    if (limite) {
      const total = await EventoEquiposModel.contarPorEvento(eventoId);
      if (total >= limite) {
        return res.status(400).json({ mensaje: 'Se alcanzó el límite de equipos permitido' });
      }
    }

    const inscripcion = await EventoEquiposModel.crear(eventoId, {
      equipo_id: equipoId,
      nombre_equipo: nombreEquipo,
      estado: 'pendiente',
    });

    res.status(201).json({ mensaje: 'Equipo inscripto', equipo: inscripcion });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const actualizarEstadoEquipo = async (req, res, estadoDestino) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    const eventoEquipoId = Number.parseInt(req.params.evento_equipo_id, 10);
    if (!Number.isInteger(eventoId) || !Number.isInteger(eventoEquipoId)) {
      return res.status(400).json({ mensaje: 'Parámetros inválidos' });
    }

    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    const equipo = await EventoEquiposModel.obtenerPorId(eventoEquipoId, eventoId);
    if (!equipo) {
      return res.status(404).json({ mensaje: 'Inscripción no encontrada' });
    }

    if (estadoDestino === 'aprobado') {
      const limite = resolveLimiteEvento(evento);
      if (limite) {
        const aprobados = await EventoEquiposModel.contarPorEvento(eventoId, {
          estado: 'aprobado',
        });
        if (aprobados >= limite && equipo.estado !== 'aprobado') {
          return res.status(400).json({ mensaje: 'Se alcanzó el límite de equipos permitido' });
        }
      }
    }

    const actualizado = await EventoEquiposModel.actualizarEstado(
      eventoEquipoId,
      eventoId,
      estadoDestino
    );

    res.json({ mensaje: `Equipo ${estadoDestino}`, equipo: actualizado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const aprobarEquipo = (req, res) => actualizarEstadoEquipo(req, res, 'aprobado');

const rechazarEquipo = (req, res) => actualizarEstadoEquipo(req, res, 'rechazado');

module.exports = {
  listEventos,
  getEvento,
  createEvento,
  updateEvento,
  deleteEvento,
  iniciarEvento,
  pausarEvento,
  finalizarEvento,
  inscribirEquipo,
  aprobarEquipo,
  rechazarEquipo,
};
