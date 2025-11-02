const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const loadClub = require('../middleware/club.middleware');
const ReservasModel = require('../models/reservas.model');
const CanchasModel = require('../models/canchas.model');
const TarifasModel = require('../models/tarifas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const ClubesModel = require('../models/clubes.model');
const UsuariosModel = require('../models/usuarios.model');
const { diaSemana1a7, addHoursHHMMSS, isPastDateTime } = require('../utils/datetime');
const { getUserId } = require('../utils/auth');
const { esEstadoReservaActivo } = require('../constants/reservasEstados');
// -----------------------------------------------------------------------------------------------

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const startOfWeek = (date) => {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  return current;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const buildTotalesAccumulator = () => ({
  total: 0,
  activas: 0,
  canceladas: 0,
  monto_total: 0,
  monto_base_total: 0,
  monto_grabacion_total: 0,
  por_estado: {},
});

const acumularTotales = (acumulador, resumen) => {
  resumen.forEach((row) => {
    const { estado, total, monto_total, monto_base_total, monto_grabacion_total } = row;
    acumulador.total += total;
    acumulador.monto_total += monto_total;
    acumulador.monto_base_total += monto_base_total;
    acumulador.monto_grabacion_total += monto_grabacion_total;
    if (esEstadoReservaActivo(estado)) acumulador.activas += total;
    if (estado === 'cancelada') acumulador.canceladas += total;
    acumulador.por_estado[estado] = (acumulador.por_estado[estado] || 0) + total;
  });
  return acumulador;
};

const parseBoolean = (value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return ['1', 'true', 'sí', 'si', 'on', 'yes'].includes(normalized);
  }
  return !!value;
};

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// POST crear reserva
const ensureClubContext = async (req, res, next) => {
  if (req.usuario && req.usuario.rol === 'club') {
    return loadClub(req, res, next);
  }
  return next();
};

router.post('/', verifyToken, ensureClubContext, async (req, res) => {
  try {
    const {
      cancha_id,
      fecha,
      hora_inicio,
      duracion_horas = 1,
      grabacion_solicitada = false,
      tipo_reserva = 'relacionada',
      jugador_usuario_id = null,
      contacto_nombre: contacto_nombre_payload = null,
      contacto_apellido: contacto_apellido_payload = null,
      contacto_telefono: contacto_telefono_payload = null,
    } = req.body;

    if (!cancha_id || !fecha || !hora_inicio) {
      return res.status(400).json({ mensaje: 'Faltan campos requeridos (cancha_id, fecha, hora_inicio)' });
    }
    const duracionHorasNumero = Number.parseInt(duracion_horas, 10);
    if (!Number.isInteger(duracionHorasNumero) || duracionHorasNumero < 1 || duracionHorasNumero > 8) {
      return res.status(400).json({ mensaje: 'duracion_horas debe ser entero entre 1 y 8' });
    }
    if (isPastDateTime(fecha, hora_inicio)) {
      return res.status(400).json({ mensaje: 'No se puede reservar en el pasado' });
    }

    const hora_fin = addHoursHHMMSS(hora_inicio, duracionHorasNumero);
    if (!hora_fin) return res.status(400).json({ mensaje: 'hora_inicio inválida' });

    const cancha = await CanchasModel.obtenerCanchaPorId(cancha_id);
    if (!cancha) return res.status(404).json({ mensaje: 'Cancha no encontrada' });

    const usuarioIdToken = getUserId(req.usuario);
    if (!usuarioIdToken) {
      return res.status(401).json({ mensaje: 'Token sin identificador de usuario' });
    }

    if (req.usuario && req.usuario.rol === 'club') {
      const clubContext = req.club || (await ClubesModel.obtenerClubPorPropietario(usuarioIdToken));
      if (!clubContext) {
        return res.status(404).json({ mensaje: 'No tienes club relacionado' });
      }
      req.club = clubContext;
      if (Number(cancha.club_id) !== Number(clubContext.club_id)) {
        return res.status(403).json({ mensaje: 'La cancha no pertenece a tu club' });
      }
    }

    // Horario comercial
    const dia = diaSemana1a7(fecha);
    if (!dia) return res.status(400).json({ mensaje: 'Fecha inválida' });
    const horarioDia = await ClubesHorarioModel.getPorClubYDia(cancha.club_id, dia);
    if (!horarioDia || !horarioDia.activo) {
      return res.status(400).json({ mensaje: 'El club está cerrado ese día' });
    }
    if (hora_inicio < horarioDia.abre || hora_fin > horarioDia.cierra) {
      return res.status(400).json({ mensaje: 'Reserva fuera del horario comercial del club' });
    }

    const tipoReservaNormalizado = tipo_reserva === 'privada' ? 'privada' : 'relacionada';

    // Solapes
    const haySolape = await ReservasModel.existeSolape({ cancha_id, fecha, hora_inicio, hora_fin });
    if (haySolape) {
      return res.status(409).json({ mensaje: 'El horario solicitado se solapa con otra reserva' });
    }

    // Precio
    const club = req.club || (await ClubesModel.obtenerClubPorId(cancha.club_id));
    if (!club) return res.status(404).json({ mensaje: 'Club no encontrado' });

    const tarifa = await TarifasModel.obtenerTarifaAplicable(cancha.club_id, dia, hora_inicio, hora_fin);
    const precioHora = tarifa ? toNumberOrZero(tarifa.precio) : toNumberOrZero(cancha.precio);
    const montoBase = precioHora * duracionHorasNumero;

    const grabacionSolicitada = parseBoolean(grabacion_solicitada);
    const montoGrabacion = grabacionSolicitada ? toNumberOrZero(club.precio_grabacion) : 0;

    const total = montoBase + montoGrabacion;

    let contactoNombre = contacto_nombre_payload;
    let contactoApellido = contacto_apellido_payload;
    let contactoTelefono = contacto_telefono_payload;
    let usuarioReservaId = null;

    if (tipoReservaNormalizado === 'relacionada') {
      const jugadorId = jugador_usuario_id ? Number.parseInt(jugador_usuario_id, 10) : null;
      if (!Number.isInteger(jugadorId) || jugadorId <= 0) {
        return res.status(400).json({ mensaje: 'jugador_usuario_id es requerido para reservas relacionadas' });
      }

      const jugador = await UsuariosModel.buscarPorId(jugadorId);
      if (!jugador) {
        return res.status(404).json({ mensaje: 'Jugador no encontrado' });
      }

      usuarioReservaId = jugador.usuario_id;
      if (!contactoNombre || !String(contactoNombre).trim()) contactoNombre = jugador.nombre || contactoNombre;
      if (!contactoApellido || !String(contactoApellido).trim()) contactoApellido = jugador.apellido || contactoApellido;
      if (!contactoTelefono || !String(contactoTelefono).trim()) contactoTelefono = jugador.telefono || contactoTelefono;
    } else {
      if (!contactoNombre || !String(contactoNombre).trim()) {
        return res
          .status(400)
          .json({ mensaje: 'contacto_nombre es requerido para reservas privadas' });
      }
      if (!contactoApellido || !String(contactoApellido).trim()) {
        return res
          .status(400)
          .json({ mensaje: 'contacto_apellido es requerido para reservas privadas' });
      }
      usuarioReservaId = null;
    }

    const reserva = await ReservasModel.crear({
      usuario_id: usuarioReservaId,
      creado_por_id: usuarioIdToken,
      cancha_id,
      fecha,
      hora_inicio,
      hora_fin,
      duracion_horas: duracionHorasNumero,
      monto: total,
      monto_base: montoBase,
      monto_grabacion: montoGrabacion,
      grabacion_solicitada: grabacionSolicitada,
      tipo_reserva: tipoReservaNormalizado,
      contacto_nombre: contactoNombre,
      contacto_apellido: contactoApellido,
      contacto_telefono: contactoTelefono,
    });

    return res.status(201).json({
      mensaje: 'Reserva creada',
      reserva: {
        ...reserva,
        monto_base: montoBase,
        monto_grabacion: montoGrabacion,
        monto: total,
      },
    });
  } catch (err) {
    if (err && err.code === ReservasModel.RESERVA_SOLAPADA_CODE) {
      return res.status(409).json({ mensaje: 'El horario solicitado se solapa con otra reserva' });
    }

    console.error(err);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.get('/panel', verifyToken, requireRole('club'), loadClub, async (req, res) => {
  try {
    const hoy = new Date();
    const fechaHoy = formatDate(hoy);
    const horaActual = formatTime(hoy);
    const { club } = req;
    const clubId = club.club_id;

    const [resumenHoy, agendaFilas, enCursoFilas] = await Promise.all([
      ReservasModel.resumenReservasClub({ club_id: clubId, fecha: fechaHoy }),
      ReservasModel.reservasAgendaClub({ club_id: clubId, fecha: fechaHoy }),
      ReservasModel.reservasEnCurso({ club_id: clubId, fecha: fechaHoy, ahora: horaActual }),
    ]);

    const totalesHoy = acumularTotales(buildTotalesAccumulator(), resumenHoy);

    const inicioSemana = startOfWeek(hoy);
    const fechasSemana = Array.from({ length: 7 }, (_, index) => formatDate(addDays(inicioSemana, index)));
    const resumenSemana = await Promise.all(
      fechasSemana.map((fecha) => ReservasModel.resumenReservasClub({ club_id: clubId, fecha }))
    );
    const totalesSemana = resumenSemana.reduce(
      (acc, resumenDia) => acumularTotales(acc, resumenDia),
      buildTotalesAccumulator()
    );

    const agendaAgrupada = agendaFilas.reduce((acc, reserva) => {
      const canchaKey = String(reserva.cancha_id);
      if (!acc[canchaKey]) {
        acc[canchaKey] = {
          cancha_id: reserva.cancha_id,
          cancha_nombre: reserva.cancha_nombre,
          reservas: [],
        };
      }
      acc[canchaKey].reservas.push(reserva);
      return acc;
    }, {});

    const agendaOrdenada = Object.values(agendaAgrupada)
      .map((grupo) => ({
        ...grupo,
        cancha_id: Number(grupo.cancha_id),
        reservas: grupo.reservas.sort((a, b) => (a.hora_inicio < b.hora_inicio ? -1 : a.hora_inicio > b.hora_inicio ? 1 : 0)),
      }))
      .sort((a, b) => {
        if (a.cancha_id === b.cancha_id) return 0;
        return a.cancha_id < b.cancha_id ? -1 : 1;
      });

    const jugandoAhora = enCursoFilas.filter((fila) => fila.estado_temporal === 'en_curso');
    const proximos = enCursoFilas.filter((fila) => fila.estado_temporal === 'pendiente');

    return res.json({
      fecha: fechaHoy,
      hora_actual: horaActual,
      totales: {
        hoy: totalesHoy,
        semana: totalesSemana,
      },
      resumen_estados_hoy: resumenHoy,
      agenda: agendaOrdenada,
      en_curso: {
        jugando_ahora: jugandoAhora,
        proximos,
        siguiente: proximos.length > 0 ? proximos[0] : null,
      },
      club: {
        club_id: clubId,
        precio_grabacion: toNumberOrZero(club.precio_grabacion),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// GET /mias
router.get('/mias', verifyToken, async (req, res) => {
  try {
    const usuarioId = getUserId(req.usuario);
    if (!usuarioId) return res.status(401).json({ mensaje: 'Token sin identificador de usuario' });
    const filas = await ReservasModel.misReservas(usuarioId);
    return res.json(filas);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// PATCH cancelar (usuario o club dueño)
router.patch('/:reserva_id/cancelar', verifyToken, async (req, res) => {
  try {
    const usuarioId = getUserId(req.usuario);
    const { reserva_id } = req.params;

    const data = await ReservasModel.getByIdConClub(reserva_id);
    if (!data) return res.status(404).json({ mensaje: 'Reserva no encontrada' });

    // dueño de la reserva:
    const esDueñoReserva = data.usuario_id === usuarioId;

    // dueño del club:
    let esClubPropietario = false;
    if (req.usuario.rol === 'club') {
      const club = await ClubesModel.obtenerClubPorPropietario(usuarioId);
      esClubPropietario = club && club.club_id === data.club_id;
    }

    if (!esDueñoReserva && !esClubPropietario) {
      return res.status(403).json({ mensaje: 'No tienes permiso para cancelar esta reserva' });
    }

    if (!esEstadoReservaActivo(data.estado)) {
      return res.status(400).json({ mensaje: `No se puede cancelar una reserva en estado ${data.estado}` });
    }

    await ReservasModel.updateEstado(reserva_id, 'cancelada');
    res.json({ mensaje: 'Reserva cancelada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
