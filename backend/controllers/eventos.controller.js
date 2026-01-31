const EventosModel = require('../models/eventos.model');
const EventoEquiposModel = require('../models/evento_equipos.model');
const EventoPartidosModel = require('../models/evento_partidos.model');
const EventoPosicionesModel = require('../models/evento_posiciones.model');
const EventoSedesModel = require('../models/evento_sedes.model');
const ClubesModel = require('../models/clubes.model');
const { normalizeHour } = require('../utils/datetime');
const {
  getLimitePorTipo,
  validateClubPermisoTipo,
  validateEstado,
  validateLimiteEquipos,
  validateTipo,
  resolveRegionalProvincia,
  isZonaRegional,
} = require('../utils/eventosRules');

const FASES_PARTIDO = new Set([
  'amistoso',
  'liga',
  'octavos',
  'cuartos',
  'semifinal',
  'final',
  'tercer_puesto',
]);

const ESTADOS_PARTIDO = new Set(['pendiente', 'jugado', 'suspendido']);

const throwValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const ensureEventoNoFinalizado = (evento, message = 'El evento está finalizado y no admite cambios') => {
  if (evento?.estado === 'finalizado') {
    throwValidationError(message);
  }
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

const parseRequiredDate = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    throwValidationError(`${fieldName} es obligatorio`);
  }
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

const parseRequiredInteger = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throwValidationError(`${fieldName} inválido`);
  }
  return parsed;
};

const parseOptionalDateTime = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throwValidationError(`${fieldName} inválida`);
  }
  return parsed;
};

const parseOptionalHour = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const normalized = normalizeHour(String(value));
  if (!normalized) {
    throwValidationError(`${fieldName} inválida`);
  }
  return normalized;
};

const parseOptionalPrice = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throwValidationError(`${fieldName} debe ser un número positivo`);
  }
  return Math.round(numeric * 100) / 100;
};

const normalizeZonaFilter = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['regional', 'provincial', 'provincia'].includes(normalized)) return 'regional';
  if (normalized === 'nacional') return 'nacional';
  return null;
};

const parseEquiposPayload = (equiposInput, { requiredCount } = {}) => {
  if (equiposInput === undefined) return [];
  if (!Array.isArray(equiposInput)) {
    throwValidationError('equipos debe ser una lista');
  }
  const equipos = equiposInput
    .filter((equipo) => equipo)
    .map((equipo, index) => {
      const equipoId = parseRequiredInteger(
        equipo?.equipo_id ?? equipo?.equipoId ?? equipo?.id,
        `equipos[${index}].equipo_id`
      );
      const nombreEquipo = parseOptionalString(
        equipo?.nombre_equipo ?? equipo?.nombre ?? equipo?.name
      );
      return {
        equipo_id: equipoId,
        nombre_equipo: nombreEquipo,
      };
    });
  if (requiredCount && equipos.length !== requiredCount) {
    throwValidationError(`equipos debe contener exactamente ${requiredCount} equipos`);
  }
  const ids = equipos.map((equipo) => equipo.equipo_id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throwValidationError('Los equipos deben ser distintos');
  }
  return equipos;
};

const parseSedesPayload = (sedesInput) => {
  if (!Array.isArray(sedesInput)) {
    throwValidationError('sedes debe ser una lista');
  }
  const sedes = sedesInput
    .filter((sede) => sede !== null && sede !== undefined)
    .map((sede, index) => {
      const canchaId = parseRequiredInteger(
        sede?.cancha_id ?? sede?.canchaId ?? sede?.id ?? sede,
        `sedes[${index}]`
      );
      return canchaId;
    });
  const unique = Array.from(new Set(sedes));
  if (unique.length !== sedes.length) {
    throwValidationError('Las sedes deben ser distintas');
  }
  return sedes;
};

const validateFasePartido = (value) => {
  if (!value) return null;
  const normalized = parseRequiredString(value, 'fase').toLowerCase();
  if (!FASES_PARTIDO.has(normalized)) {
    throwValidationError('fase inválida');
  }
  return normalized;
};

const validateEstadoPartido = (value) => {
  if (!value) return null;
  const normalized = parseRequiredString(value, 'estado').toLowerCase();
  if (!ESTADOS_PARTIDO.has(normalized)) {
    throwValidationError('estado inválido');
  }
  return normalized;
};

const resolveDefaultFase = (eventoTipo, providedFase) => {
  if (providedFase) return providedFase;
  if (eventoTipo === 'copa') {
    throwValidationError('fase es obligatoria para copas');
  }
  if (eventoTipo === 'amistoso') return 'amistoso';
  return 'liga';
};

const NEXT_FASE_MAP = {
  octavos: 'cuartos',
  cuartos: 'semifinal',
  semifinal: 'final',
};

const resolveLimiteEvento = (evento) => {
  if (!evento) return null;
  if (evento.limite_equipos) return Number(evento.limite_equipos);
  return getLimitePorTipo(evento.tipo);
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const cargarDetallesEvento = async (eventoId) => {
  const results = await Promise.allSettled([
    EventoEquiposModel.listarPorEvento(eventoId),
    EventoPartidosModel.listarPorEvento(eventoId),
    EventoPosicionesModel.listarPorEvento(eventoId),
    EventoSedesModel.listarPorEvento(eventoId),
  ]);

  const [equiposResult, partidosResult, posicionesResult, sedesResult] = results;
  const safeValue = (result, label) => {
    if (result.status === 'fulfilled') {
      return ensureArray(result.value);
    }
    console.warn(`No se pudieron cargar ${label} para el evento ${eventoId}`, result.reason);
    return [];
  };

  return {
    equipos: safeValue(equiposResult, 'equipos'),
    partidos: safeValue(partidosResult, 'partidos'),
    posiciones: safeValue(posicionesResult, 'posiciones'),
    sedes: safeValue(sedesResult, 'sedes'),
  };
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

const listEventosGlobales = async (req, res) => {
  try {
    let club = req.club ?? null;
    if (!club) {
      const clubId = parseRequiredInteger(
        req.query?.club_id ??
          req.body?.club_id ??
          req.usuario?.club_id ??
          req.usuario?.clubId,
        'club_id'
      );
      club = await ClubesModel.obtenerClubPorId(clubId);
    }
    if (!club) {
      return res.status(404).json({ mensaje: 'Club no encontrado' });
    }
    const provinciaId = club.provincia_id ?? null;
    const zonaFilter = normalizeZonaFilter(
      req.query?.zona ?? req.query?.scope ?? req.query?.filtro
    );
    if (zonaFilter === 'regional' && !provinciaId) {
      return res.json({ eventos: [] });
    }
    const eventos = await EventosModel.listarGlobales({ provinciaId, zona: zonaFilter });
    res.json({ eventos });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const getEventoGlobal = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const evento = await EventosModel.obtenerGlobalPorId(eventoId);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    const { equipos, partidos, posiciones, sedes } = await cargarDetallesEvento(eventoId);

    res.json({ evento: { ...evento, equipos, partidos, posiciones, sedes } });
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
    ensureEventoNoFinalizado(evento);
    const { equipos, partidos, posiciones, sedes } = await cargarDetallesEvento(eventoId);
    res.json({ evento: { ...evento, equipos, partidos, posiciones, sedes } });
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
    const fecha_inicio = parseRequiredDate(req.body?.fecha_inicio, 'fecha_inicio');
    const fecha_fin = parseOptionalDate(req.body?.fecha_fin, 'fecha_fin');
    if (fecha_fin && fecha_fin < fecha_inicio) {
      throwValidationError('fecha_fin debe ser posterior a fecha_inicio');
    }
    const zona = parseOptionalString(req.body?.zona) || 'regional';
    const provincia_id = resolveRegionalProvincia({ ...(req.body || {}), zona }, req.club);
    const limite_equipos = validateLimiteEquipos(tipo, req.body?.limite_equipos);
    const deporte_id = parseRequiredInteger(req.body?.deporte_id, 'deporte_id');
    const hora_inicio = parseOptionalHour(req.body?.hora_inicio, 'hora_inicio');
    const hora_fin = parseOptionalHour(req.body?.hora_fin, 'hora_fin');
    const valor_inscripcion = parseOptionalPrice(req.body?.valor_inscripcion, 'valor_inscripcion');
    const premio_1 = parseOptionalString(req.body?.premio_1);
    const premio_2 = parseOptionalString(req.body?.premio_2);
    const premio_3 = parseOptionalString(req.body?.premio_3);
    const imagen_url = parseOptionalString(req.body?.imagen_url);
    const equipos = parseEquiposPayload(req.body?.equipos ?? [], {
      requiredCount: tipo === 'amistoso' ? 2 : undefined,
    });
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
      deporte_id,
      hora_inicio,
      hora_fin,
      valor_inscripcion,
      premio_1,
      premio_2,
      premio_3,
      imagen_url,
    });

    if (equipos.length > 0) {
      await Promise.all(
        equipos.map((equipo) =>
          EventoEquiposModel.crear(evento.evento_id, {
            equipo_id: equipo.equipo_id,
            estado: 'aprobado',
            origen: 'club',
          })
        )
      );
    }

    const eventoConEquipos =
      equipos.length > 0
        ? { ...evento, equipos: await EventoEquiposModel.listarPorEvento(evento.evento_id) }
        : evento;

    res.status(201).json({ mensaje: 'Evento creado', evento: eventoConEquipos });
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

    ensureEventoNoFinalizado(existente);

    const baseFields = [
      'nombre',
      'tipo',
      'descripcion',
      'fecha_inicio',
      'fecha_fin',
      'hora_inicio',
      'hora_fin',
      'zona',
      'zona_regional',
      'provincia_id',
      'limite_equipos',
      'deporte_id',
      'valor_inscripcion',
      'premio_1',
      'premio_2',
      'premio_3',
      'imagen_url',
    ];
    const hasBaseUpdates = baseFields.some((field) => req.body?.[field] !== undefined);
    if (hasBaseUpdates && existente.estado !== 'inactivo') {
      throwValidationError('El evento está en modo solo lectura');
    }

    if (req.body?.equipos !== undefined && existente.estado !== 'inactivo') {
      throwValidationError('El evento está en modo solo lectura');
    }

    if (req.body?.estado !== undefined && existente.estado !== 'inactivo') {
      throwValidationError('estado solo editable cuando el evento está inactivo');
    }

    const updates = {};
    const equiposInput = req.body?.equipos;
    const equipos =
      equiposInput !== undefined
        ? parseEquiposPayload(equiposInput, {
          requiredCount: existente.tipo === 'amistoso' ? 2 : undefined,
        })
        : [];

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

    const fechaInicio = updates.fecha_inicio ?? existente.fecha_inicio;
    const fechaFin = updates.fecha_fin ?? existente.fecha_fin;
    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(fin.getTime()) && fin < inicio) {
        throwValidationError('fecha_fin debe ser posterior a fecha_inicio');
      }
    }

    if (req.body?.hora_inicio !== undefined) {
      updates.hora_inicio = parseOptionalHour(req.body.hora_inicio, 'hora_inicio');
    }
    if (req.body?.hora_fin !== undefined) {
      updates.hora_fin = parseOptionalHour(req.body.hora_fin, 'hora_fin');
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

    if (req.body?.deporte_id !== undefined) {
      updates.deporte_id = parseRequiredInteger(req.body.deporte_id, 'deporte_id');
    }

    if (req.body?.valor_inscripcion !== undefined) {
      updates.valor_inscripcion = parseOptionalPrice(req.body.valor_inscripcion, 'valor_inscripcion');
    }

    if (req.body?.premio_1 !== undefined) {
      updates.premio_1 = parseOptionalString(req.body.premio_1);
    }

    if (req.body?.premio_2 !== undefined) {
      updates.premio_2 = parseOptionalString(req.body.premio_2);
    }

    if (req.body?.premio_3 !== undefined) {
      updates.premio_3 = parseOptionalString(req.body.premio_3);
    }

    if (req.body?.imagen_url !== undefined) {
      updates.imagen_url = parseOptionalString(req.body.imagen_url);
    }

    const evento = await EventosModel.actualizar(eventoId, req.club.club_id, updates);

    if (equiposInput !== undefined) {
      await EventoEquiposModel.eliminarPorEvento(eventoId);
      await Promise.all(
        equipos.map((equipo) =>
          EventoEquiposModel.crear(eventoId, {
            equipo_id: equipo.equipo_id,
            estado: 'aprobado',
            origen: 'club',
          })
        )
      );
    }

    const eventoConEquipos =
      equiposInput !== undefined
        ? { ...evento, equipos: await EventoEquiposModel.listarPorEvento(eventoId) }
        : evento;

    res.json({ mensaje: 'Evento actualizado', evento: eventoConEquipos });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const listEventoSedes = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }
    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    const sedes = await EventoSedesModel.listarPorEvento(eventoId);
    res.json({ sedes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const updateEventoSedes = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }
    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    if (evento.estado !== 'inactivo') {
      throwValidationError('El evento está en modo solo lectura');
    }

    const sedesInput = req.body?.sedes ?? req.body?.canchas ?? req.body?.cancha_ids;
    const sedes = parseSedesPayload(sedesInput ?? []);

    await EventoSedesModel.eliminarPorEvento(eventoId);
    if (sedes.length > 0) {
      await Promise.all(
        sedes.map((canchaId) => EventoSedesModel.crear(eventoId, { cancha_id: canchaId }))
      );
    }
    const updated = await EventoSedesModel.listarPorEvento(eventoId);
    res.json({ mensaje: 'Sedes actualizadas', sedes: updated });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const uploadEventoImagen = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const existente = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: 'Debe adjuntar un archivo "imagen"' });
    }

    await EventosModel.actualizarImagen(eventoId, req.club.club_id, req.file);
    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);

    res.json({
      mensaje: 'Imagen actualizada',
      imagen_url: evento ? evento.imagen_url : null,
      evento,
    });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const uploadEventoReglamento = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const existente = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: 'Debe adjuntar un archivo "reglamento"' });
    }

    const isPdf =
      req.file.mimetype === 'application/pdf' ||
      String(req.file.originalname || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return res.status(400).json({ mensaje: 'El reglamento debe ser un PDF' });
    }

    const reglamentoUrl = await EventosModel.actualizarReglamento(
      eventoId,
      req.club.club_id,
      req.file
    );
    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);

    res.json({
      mensaje: 'Reglamento actualizado',
      reglamento_url: reglamentoUrl,
      evento,
    });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const getEventoReglamento = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    ensureEventoNoFinalizado(evento);

    if (!evento.reglamento_blob) {
      return res.status(404).json({ mensaje: 'Reglamento no disponible' });
    }

    res.setHeader('Content-Type', evento.reglamento_mime || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${evento.reglamento_nombre || 'reglamento.pdf'}"`
    );
    res.send(evento.reglamento_blob);
  } catch (error) {
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

    const existente = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    if (existente.estado === 'finalizado') {
      return res.status(400).json({ mensaje: 'No se puede eliminar un evento finalizado' });
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

    ensureEventoNoFinalizado(evento, 'No se pueden modificar equipos en un evento finalizado');

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

const createPartido = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }

    const faseInput = req.body?.fase !== undefined ? validateFasePartido(req.body.fase) : null;
    const fase = resolveDefaultFase(evento.tipo, faseInput);

    if (evento.tipo === 'copa' && ['liga', 'amistoso'].includes(fase)) {
      throwValidationError('fase inválida para copa');
    }
    if (evento.tipo === 'amistoso' && fase !== 'amistoso') {
      throwValidationError('fase inválida para amistoso');
    }
    if (['liga', 'torneo'].includes(evento.tipo) && fase !== 'liga') {
      throwValidationError('fase inválida para liga/torneo');
    }

    let orden = parseOptionalInteger(req.body?.orden, 'orden');
    const jornada = parseOptionalInteger(req.body?.jornada, 'jornada');
    if (evento.tipo === 'copa' && (orden === undefined || orden === null)) {
      if (['final', 'tercer_puesto'].includes(fase)) {
        orden = 1;
      } else {
        throwValidationError('orden es obligatorio para la fase');
      }
    }

    const sedeId = parseOptionalInteger(
      req.body?.sede_id ?? req.body?.cancha_id,
      'sede_id'
    );
    const equipoLocalId = parseOptionalInteger(req.body?.equipo_local_id, 'equipo_local_id');
    const equipoVisitanteId = parseOptionalInteger(
      req.body?.equipo_visitante_id,
      'equipo_visitante_id'
    );
    if (
      equipoLocalId !== null &&
      equipoVisitanteId !== null &&
      equipoLocalId !== undefined &&
      equipoVisitanteId !== undefined &&
      equipoLocalId === equipoVisitanteId
    ) {
      throwValidationError('Los equipos no pueden ser iguales');
    }

    const fecha = parseOptionalDateTime(req.body?.fecha, 'fecha');
    const marcadorLocal = parseOptionalInteger(
      req.body?.marcador_local ?? req.body?.goles_local,
      'marcador_local'
    );
    const marcadorVisitante = parseOptionalInteger(
      req.body?.marcador_visitante ?? req.body?.goles_visitante,
      'marcador_visitante'
    );

    const estado = validateEstadoPartido(req.body?.estado) || 'pendiente';

    const partido = await EventoPartidosModel.crear(eventoId, {
      fase,
      jornada,
      orden,
      sede_id: sedeId,
      equipo_local_id: equipoLocalId,
      equipo_visitante_id: equipoVisitanteId,
      fecha,
      marcador_local: marcadorLocal,
      marcador_visitante: marcadorVisitante,
      ganador_equipo_id: null,
      estado,
    });

    res.status(201).json({ mensaje: 'Partido creado', partido });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const updatePartido = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    const partidoId = Number.parseInt(req.params.evento_partido_id, 10);
    if (!Number.isInteger(eventoId) || !Number.isInteger(partidoId)) {
      return res.status(400).json({ mensaje: 'Parámetros inválidos' });
    }

    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    ensureEventoNoFinalizado(evento);

    const partido = await EventoPartidosModel.obtenerPorId(partidoId, eventoId);
    if (!partido) {
      return res.status(404).json({ mensaje: 'Partido no encontrado' });
    }

    const updates = {};

    if (req.body?.fase !== undefined) {
      updates.fase = validateFasePartido(req.body.fase);
      if (evento.tipo === 'copa' && ['liga', 'amistoso'].includes(updates.fase)) {
        throwValidationError('fase inválida para copa');
      }
      if (evento.tipo === 'amistoso' && updates.fase !== 'amistoso') {
        throwValidationError('fase inválida para amistoso');
      }
      if (['liga', 'torneo'].includes(evento.tipo) && updates.fase !== 'liga') {
        throwValidationError('fase inválida para liga/torneo');
      }
    }

    if (req.body?.orden !== undefined) {
      updates.orden = parseOptionalInteger(req.body.orden, 'orden');
    }
    if (req.body?.jornada !== undefined) {
      updates.jornada = parseOptionalInteger(req.body.jornada, 'jornada');
    }
    if (req.body?.sede_id !== undefined || req.body?.cancha_id !== undefined) {
      updates.sede_id = parseOptionalInteger(
        req.body.sede_id ?? req.body.cancha_id,
        'sede_id'
      );
    }
    if (req.body?.equipo_local_id !== undefined) {
      updates.equipo_local_id = parseOptionalInteger(
        req.body.equipo_local_id,
        'equipo_local_id'
      );
    }
    if (req.body?.equipo_visitante_id !== undefined) {
      updates.equipo_visitante_id = parseOptionalInteger(
        req.body.equipo_visitante_id,
        'equipo_visitante_id'
      );
    }
    if (
      (updates.equipo_local_id ?? partido.equipo_local_id) !== null &&
      (updates.equipo_visitante_id ?? partido.equipo_visitante_id) !== null &&
      (updates.equipo_local_id ?? partido.equipo_local_id) !== undefined &&
      (updates.equipo_visitante_id ?? partido.equipo_visitante_id) !== undefined &&
      (updates.equipo_local_id ?? partido.equipo_local_id) ===
        (updates.equipo_visitante_id ?? partido.equipo_visitante_id)
    ) {
      throwValidationError('Los equipos no pueden ser iguales');
    }

    if (req.body?.fecha !== undefined) {
      updates.fecha = parseOptionalDateTime(req.body.fecha, 'fecha');
    }
    if (req.body?.marcador_local !== undefined || req.body?.goles_local !== undefined) {
      updates.marcador_local = parseOptionalInteger(
        req.body.marcador_local ?? req.body.goles_local,
        'marcador_local'
      );
    }
    if (req.body?.marcador_visitante !== undefined || req.body?.goles_visitante !== undefined) {
      updates.marcador_visitante = parseOptionalInteger(
        req.body.marcador_visitante ?? req.body.goles_visitante,
        'marcador_visitante'
      );
    }
    if (req.body?.estado !== undefined) {
      updates.estado = validateEstadoPartido(req.body.estado);
    }

    const actualizado = await EventoPartidosModel.actualizar(partidoId, eventoId, updates);
    res.json({ mensaje: 'Partido actualizado', partido: actualizado });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const setGanadorPartido = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    const partidoId = Number.parseInt(req.params.evento_partido_id, 10);
    if (!Number.isInteger(eventoId) || !Number.isInteger(partidoId)) {
      return res.status(400).json({ mensaje: 'Parámetros inválidos' });
    }

    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    ensureEventoNoFinalizado(evento);

    const partido = await EventoPartidosModel.obtenerPorId(partidoId, eventoId);
    if (!partido) {
      return res.status(404).json({ mensaje: 'Partido no encontrado' });
    }

    const ganadorEquipoId = parseOptionalInteger(req.body?.ganador_equipo_id, 'ganador_equipo_id');
    if (!ganadorEquipoId) {
      throwValidationError('ganador_equipo_id es obligatorio');
    }

    if (![partido.equipo_local_id, partido.equipo_visitante_id].includes(ganadorEquipoId)) {
      throwValidationError('El ganador debe ser un equipo del partido');
    }

    const updates = {
      ganador_equipo_id: ganadorEquipoId,
      estado: 'jugado',
    };

    if (req.body?.marcador_local !== undefined || req.body?.goles_local !== undefined) {
      updates.marcador_local = parseOptionalInteger(
        req.body.marcador_local ?? req.body.goles_local,
        'marcador_local'
      );
    }
    if (req.body?.marcador_visitante !== undefined || req.body?.goles_visitante !== undefined) {
      updates.marcador_visitante = parseOptionalInteger(
        req.body.marcador_visitante ?? req.body.goles_visitante,
        'marcador_visitante'
      );
    }

    const actualizado = await EventoPartidosModel.actualizar(partidoId, eventoId, updates);

    if (evento.tipo === 'copa') {
      const nextFase = NEXT_FASE_MAP[partido.fase];
      if (nextFase && Number.isInteger(partido.orden)) {
        const nextOrden = Math.ceil(partido.orden / 2);
        const siguiente = await EventoPartidosModel.obtenerPorFaseOrden(
          eventoId,
          nextFase,
          nextOrden
        );
        if (siguiente) {
          const slotKey = partido.orden % 2 === 1 ? 'equipo_local_id' : 'equipo_visitante_id';
          if (siguiente[slotKey] && Number(siguiente[slotKey]) !== ganadorEquipoId) {
            throwValidationError('El siguiente cruce ya tiene un equipo asignado');
          }
          if (!siguiente[slotKey]) {
            await EventoPartidosModel.actualizar(siguiente.evento_partido_id, eventoId, {
              [slotKey]: ganadorEquipoId,
            });
          }
        }
      }
    }

    res.json({ mensaje: 'Ganador asignado', partido: actualizado });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const createPosicion = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    if (!Number.isInteger(eventoId)) {
      return res.status(400).json({ mensaje: 'evento_id inválido' });
    }

    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    ensureEventoNoFinalizado(evento);

    if (!['torneo', 'liga'].includes(evento.tipo)) {
      return res.status(400).json({ mensaje: 'Solo disponible para torneos o ligas' });
    }

    const equipoId = parseOptionalInteger(req.body?.equipo_id, 'equipo_id');
    if (!equipoId) {
      throwValidationError('equipo_id es obligatorio');
    }

    const posicion = await EventoPosicionesModel.crear(eventoId, {
      equipo_id: equipoId,
      puntos: parseOptionalInteger(req.body?.puntos, 'puntos') ?? 0,
      partidos_jugados:
        parseOptionalInteger(req.body?.partidos_jugados ?? req.body?.pj, 'partidos_jugados') ??
        0,
      victorias: parseOptionalInteger(req.body?.victorias ?? req.body?.pg, 'victorias') ?? 0,
      empates: parseOptionalInteger(req.body?.empates ?? req.body?.pe, 'empates') ?? 0,
      derrotas: parseOptionalInteger(req.body?.derrotas ?? req.body?.pp, 'derrotas') ?? 0,
      goles_favor: parseOptionalInteger(req.body?.goles_favor ?? req.body?.gf, 'goles_favor') ?? 0,
      goles_contra:
        parseOptionalInteger(req.body?.goles_contra ?? req.body?.gc, 'goles_contra') ?? 0,
      orden: parseOptionalInteger(req.body?.orden, 'orden'),
    });

    res.status(201).json({ mensaje: 'Posición creada', posicion });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const updatePosicion = async (req, res) => {
  try {
    const eventoId = Number.parseInt(req.params.evento_id, 10);
    const posicionId = Number.parseInt(req.params.evento_posicion_id, 10);
    if (!Number.isInteger(eventoId) || !Number.isInteger(posicionId)) {
      return res.status(400).json({ mensaje: 'Parámetros inválidos' });
    }

    const evento = await EventosModel.obtenerPorId(eventoId, req.club.club_id);
    if (!evento) {
      return res.status(404).json({ mensaje: 'Evento no encontrado' });
    }
    ensureEventoNoFinalizado(evento);

    if (!['torneo', 'liga'].includes(evento.tipo)) {
      return res.status(400).json({ mensaje: 'Solo disponible para torneos o ligas' });
    }

    const existente = await EventoPosicionesModel.obtenerPorId(posicionId, eventoId);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Posición no encontrada' });
    }

    const updates = {};
    if (req.body?.puntos !== undefined) {
      updates.puntos = parseOptionalInteger(req.body.puntos, 'puntos');
    }
    if (req.body?.partidos_jugados !== undefined || req.body?.pj !== undefined) {
      updates.partidos_jugados = parseOptionalInteger(
        req.body?.partidos_jugados ?? req.body?.pj,
        'partidos_jugados'
      );
    }
    if (req.body?.orden !== undefined) {
      updates.orden = parseOptionalInteger(req.body.orden, 'orden');
    }

    const actualizado = await EventoPosicionesModel.actualizar(posicionId, eventoId, updates);
    res.json({ mensaje: 'Posición actualizada', posicion: actualizado });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 403) {
      return res.status(error.statusCode).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

module.exports = {
  listEventos,
  listEventosGlobales,
  getEventoGlobal,
  getEvento,
  createEvento,
  updateEvento,
  uploadEventoImagen,
  uploadEventoReglamento,
  getEventoReglamento,
  deleteEvento,
  listEventoSedes,
  updateEventoSedes,
  iniciarEvento,
  pausarEvento,
  finalizarEvento,
  inscribirEquipo,
  aprobarEquipo,
  rechazarEquipo,
  createPartido,
  updatePartido,
  setGanadorPartido,
  createPosicion,
  updatePosicion,
};
