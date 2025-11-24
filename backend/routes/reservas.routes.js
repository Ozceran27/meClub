const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const loadClub = require('../middleware/club.middleware');
const ReservasModel = require('../models/reservas.model');
const CanchasModel = require('../models/canchas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const ClubesModel = require('../models/clubes.model');
const UsuariosModel = require('../models/usuarios.model');
const { diaSemana1a7, addHoursHHMMSS, isPastDateTime } = require('../utils/datetime');
const { calculateBaseAmount, determineRateType, toNumberOrNull } = require('../utils/pricing');
const { getUserId } = require('../utils/auth');
const {
  esEstadoReservaActivo,
  esEstadoReservaValido,
  ESTADOS_PAGO_PERMITIDOS,
  normalizarEstadoPago,
} = require('../constants/reservasEstados');
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

const parseFechaYYYYMMDD = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [year, month, day] = trimmed.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
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

const toNullableNumber = (value) => toNumberOrNull(value);

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
      estado_pago = 'pendiente_pago',
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

    const estadoPagoNormalizado = normalizarEstadoPago(estado_pago);
    if (!estadoPagoNormalizado) {
      return res.status(400).json({ mensaje: 'estado_pago inválido' });
    }

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
    const horaInicioMs = new Date(`${fecha}T${hora_inicio}`).getTime();
    const horaFinMs = horaInicioMs + duracionHorasNumero * 60 * 60 * 1000;
    const horarioAbreMs = new Date(`${fecha}T${horarioDia.abre}`).getTime();
    const horarioCierraMs = new Date(`${fecha}T${horarioDia.cierra}`).getTime();

    const horariosInvalidos = [horaInicioMs, horaFinMs, horarioAbreMs, horarioCierraMs].some((value) =>
      Number.isNaN(value)
    );
    if (horariosInvalidos) {
      return res.status(400).json({ mensaje: 'Reserva fuera del horario comercial del club' });
    }

    if (horaInicioMs < horarioAbreMs || horaFinMs > horarioCierraMs) {
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

    const appliedRateType = determineRateType({ horaInicio: hora_inicio, club });
    const montoBase = calculateBaseAmount({
      cancha,
      club,
      horaInicio: hora_inicio,
      duracionHoras: duracionHorasNumero,
    });

    const grabacionSolicitada = parseBoolean(grabacion_solicitada);
    const montoGrabacion = grabacionSolicitada ? toNumberOrZero(club.precio_grabacion) : 0;

    const total = montoBase + montoGrabacion;

    let contactoNombre = contacto_nombre_payload;
    let contactoApellido = contacto_apellido_payload;
    let contactoTelefono = contacto_telefono_payload;
    let usuarioReservaId = null;

    if (tipoReservaNormalizado === 'relacionada') {
      const jugadorIdBruto =
        jugador_usuario_id ?? (req.usuario && req.usuario.rol !== 'club' ? usuarioIdToken : null);
      const jugadorId =
        jugadorIdBruto === null || jugadorIdBruto === undefined
          ? null
          : Number.parseInt(jugadorIdBruto, 10);

      if (!Number.isInteger(jugadorId) || jugadorId <= 0) {
        return res.status(400).json({ mensaje: 'jugador_usuario_id es requerido para reservas relacionadas' });
      }

      if (jugadorId === usuarioIdToken) {
        usuarioReservaId = usuarioIdToken;
      } else {
        const jugador = await UsuariosModel.buscarPorId(jugadorId);
        if (!jugador) {
          return res.status(404).json({ mensaje: 'Jugador no encontrado' });
        }

        usuarioReservaId = jugador.usuario_id;
        if (!contactoNombre || !String(contactoNombre).trim()) contactoNombre = jugador.nombre || contactoNombre;
        if (!contactoApellido || !String(contactoApellido).trim())
          contactoApellido = jugador.apellido || contactoApellido;
        if (!contactoTelefono || !String(contactoTelefono).trim())
          contactoTelefono = jugador.telefono || contactoTelefono;
      }
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
      club_id: cancha.club_id,
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
      estado_pago: estadoPagoNormalizado,
    });

    return res.status(201).json({
      mensaje: 'Reserva creada',
      reserva: {
        ...reserva,
        monto_base: montoBase,
        monto_grabacion: montoGrabacion,
        monto: total,
        tarifa_tipo: appliedRateType,
        estado_pago: estadoPagoNormalizado,
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
    const horaActual = formatTime(hoy);
    const { fecha: fechaQuery } = req.query;
    let fechaReferencia = hoy;
    let fechaSeleccionada = formatDate(hoy);

    if (typeof fechaQuery === 'string' && fechaQuery.trim()) {
      const fechaParseada = parseFechaYYYYMMDD(fechaQuery);
      if (!fechaParseada) {
        return res.status(400).json({
          mensaje: 'Parámetro fecha inválido. Use el formato YYYY-MM-DD.',
        });
      }
      fechaReferencia = fechaParseada;
      fechaSeleccionada = formatDate(fechaParseada);
    }

    const { club } = req;
    const clubId = club.club_id;

    const [resumenHoy, agendaFilas, enCursoFilas, canchasClub] = await Promise.all([
      ReservasModel.resumenReservasClub({ club_id: clubId, fecha: fechaSeleccionada }),
      ReservasModel.reservasAgendaClub({ club_id: clubId, fecha: fechaSeleccionada }),
      ReservasModel.reservasEnCurso({
        club_id: clubId,
        fecha: fechaSeleccionada,
        ahora: horaActual,
      }),
      CanchasModel.listarPorClub(clubId),
    ]);

    const totalesHoy = acumularTotales(buildTotalesAccumulator(), resumenHoy);

    const inicioSemana = startOfWeek(fechaReferencia);
    const fechasSemana = Array.from({ length: 7 }, (_, index) => formatDate(addDays(inicioSemana, index)));
    const resumenSemana = await Promise.all(
      fechasSemana.map((fecha) => ReservasModel.resumenReservasClub({ club_id: clubId, fecha }))
    );
    const totalesSemana = resumenSemana.reduce(
      (acc, resumenDia) => acumularTotales(acc, resumenDia),
      buildTotalesAccumulator()
    );

    const mergePricingIntoGroup = (grupo, source = {}) => {
      if (!grupo) return;

      const precioDia = toNullableNumber(
        source.precio_dia ?? source.precioDia ?? source.cancha_precio_dia
      );
      const precioNoche = toNullableNumber(
        source.precio_noche ?? source.precioNoche ?? source.cancha_precio_noche
      );
      const precioGenerico = toNullableNumber(source.precio ?? source.monto_base);

      if (precioDia !== null && (grupo.precio_dia === null || grupo.precio_dia === undefined)) {
        grupo.precio_dia = precioDia;
      }

      if (
        precioNoche !== null &&
        (grupo.precio_noche === null || grupo.precio_noche === undefined)
      ) {
        grupo.precio_noche = precioNoche;
      }

      const fallbackGenerico =
        precioGenerico !== null
          ? precioGenerico
          : precioDia !== null
          ? precioDia
          : precioNoche !== null
          ? precioNoche
          : null;

      if (fallbackGenerico !== null && (grupo.precio === null || grupo.precio === undefined)) {
        grupo.precio = fallbackGenerico;
      }
    };

    const agendaAgrupada = agendaFilas.reduce((acc, reserva) => {
      const canchaKey = String(reserva.cancha_id);
      if (!acc[canchaKey]) {
        acc[canchaKey] = {
          cancha_id: reserva.cancha_id,
          cancha_nombre: reserva.cancha_nombre,
          precio: null,
          precio_dia: null,
          precio_noche: null,
          reservas: [],
        };
      }
      mergePricingIntoGroup(acc[canchaKey], reserva);
      acc[canchaKey].reservas.push(reserva);
      return acc;
    }, {});

    const canchasDisponibles = Array.isArray(canchasClub)
      ? canchasClub.filter((cancha) => cancha && cancha.estado === 'disponible')
      : [];

    canchasDisponibles.forEach((cancha) => {
      const canchaKey = String(cancha.cancha_id);
      if (!agendaAgrupada[canchaKey]) {
        agendaAgrupada[canchaKey] = {
          cancha_id: cancha.cancha_id,
          cancha_nombre: cancha.nombre,
          precio: null,
          precio_dia: null,
          precio_noche: null,
          reservas: [],
        };
      } else if (!agendaAgrupada[canchaKey].cancha_nombre) {
        agendaAgrupada[canchaKey].cancha_nombre = cancha.nombre;
      }
      mergePricingIntoGroup(agendaAgrupada[canchaKey], cancha);
    });

    const agendaOrdenada = Object.values(agendaAgrupada)
      .map((grupo) => ({
        ...grupo,
        cancha_id: Number(grupo.cancha_id),
        precio: toNullableNumber(grupo.precio),
        precio_dia: toNullableNumber(grupo.precio_dia),
        precio_noche: toNullableNumber(grupo.precio_noche),
        reservas: grupo.reservas.sort((a, b) => (a.hora_inicio < b.hora_inicio ? -1 : a.hora_inicio > b.hora_inicio ? 1 : 0)),
      }))
      .sort((a, b) => {
        if (a.cancha_id === b.cancha_id) return 0;
        return a.cancha_id < b.cancha_id ? -1 : 1;
      });

    const jugandoAhora = enCursoFilas.filter((fila) => fila.estado_temporal === 'en_curso');
    const proximos = enCursoFilas.filter((fila) => fila.estado_temporal === 'pendiente');

    return res.json({
      fecha: fechaSeleccionada,
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
        hora_nocturna_inicio: club.hora_nocturna_inicio || null,
        hora_nocturna_fin: club.hora_nocturna_fin || null,
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

router.delete('/:reserva_id', verifyToken, requireRole('club'), loadClub, async (req, res) => {
  const { reserva_id: reservaIdParam } = req.params;
  const reservaId = Number.parseInt(reservaIdParam, 10);

  if (!Number.isInteger(reservaId) || reservaId <= 0) {
    return res.status(400).json({ mensaje: 'Identificador de reserva inválido' });
  }

  try {
    const reserva = await ReservasModel.getByIdConClub(reservaId);
    if (!reserva) {
      return res.status(404).json({ mensaje: 'Reserva no encontrada' });
    }

    const clubId = Number(req.club?.club_id);
    if (!Number.isInteger(clubId)) {
      return res.status(404).json({ mensaje: 'No tienes club relacionado' });
    }

    if (Number(reserva.club_id) !== clubId) {
      return res.status(403).json({ mensaje: 'La reserva no pertenece a tu club' });
    }

    await ReservasModel.eliminar({ reserva_id: reservaId, club_id: clubId });
    return res.json({ mensaje: 'Reserva eliminada' });
  } catch (err) {
    if (err && err.code === ReservasModel.RESERVA_NO_ENCONTRADA_CODE) {
      return res.status(404).json({ mensaje: 'Reserva no encontrada' });
    }

    console.error(err);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.patch(
  '/:reserva_id/estado',
  verifyToken,
  requireRole('club'),
  loadClub,
  async (req, res) => {
    const { reserva_id: reservaIdParam } = req.params;
    const reservaId = Number.parseInt(reservaIdParam, 10);

    if (!Number.isInteger(reservaId) || reservaId <= 0) {
      return res.status(400).json({ mensaje: 'Identificador de reserva inválido' });
    }

    const { estado: estadoRaw, estado_pago: estadoPagoRaw } = req.body || {};

    const normalizar = (valor) => {
      if (valor === undefined) return undefined;
      if (valor === null) return null;
      const texto = typeof valor === 'string' ? valor.trim() : String(valor).trim();
      if (!texto) return null;
      return texto.toLowerCase();
    };

    const normalizarPago = (valor) => {
      if (valor === undefined) return undefined;
      if (valor === null) return null;
      return normalizarEstadoPago(valor);
    };

    const mensajeEstadoPagoInvalido = `Estado de pago inválido. Valores permitidos: ${ESTADOS_PAGO_PERMITIDOS.join(', ')}`;

    const estadoNormalizado = normalizar(estadoRaw);
    const estadoPagoNormalizado = normalizarPago(estadoPagoRaw);

    if (estadoNormalizado === undefined && estadoPagoNormalizado === undefined) {
      return res
        .status(400)
        .json({ mensaje: 'Debes enviar al menos un campo (estado o estado_pago)' });
    }

    if (estadoNormalizado === null) {
      return res.status(400).json({ mensaje: 'Estado inválido' });
    }

    if (estadoPagoNormalizado === null) {
      return res.status(400).json({ mensaje: mensajeEstadoPagoInvalido });
    }

    if (estadoNormalizado !== undefined && !esEstadoReservaValido(estadoNormalizado)) {
      return res.status(400).json({ mensaje: 'Estado inválido' });
    }

    if (estadoPagoNormalizado !== undefined && !estadoPagoNormalizado) {
      return res.status(400).json({ mensaje: mensajeEstadoPagoInvalido });
    }

    try {
      const reserva = await ReservasModel.getByIdConClub(reservaId);
      if (!reserva) {
        return res.status(404).json({ mensaje: 'Reserva no encontrada' });
      }

      const clubId = Number(req.club?.club_id);
      if (!Number.isInteger(clubId)) {
        return res.status(404).json({ mensaje: 'No tienes club relacionado' });
      }

      if (Number(reserva.club_id) !== clubId) {
        return res.status(403).json({ mensaje: 'La reserva no pertenece a tu club' });
      }

      const resultado = await ReservasModel.actualizarEstados({
        reserva_id: reservaId,
        ...(estadoNormalizado !== undefined ? { estado: estadoNormalizado } : {}),
        ...(estadoPagoNormalizado !== undefined ? { estado_pago: estadoPagoNormalizado } : {}),
      });

      if (!resultado?.updated) {
        return res.status(404).json({ mensaje: 'Reserva no encontrada' });
      }

      const reservaActualizada = {
        ...reserva,
        ...(resultado.estado ? { estado: resultado.estado } : {}),
        ...(resultado.estado_pago ? { estado_pago: resultado.estado_pago } : {}),
      };

      return res.json({
        mensaje: 'Estado de reserva actualizado',
        reserva: reservaActualizada,
      });
    } catch (err) {
      if (err?.code === 'RESERVA_ESTADO_INVALIDO') {
        return res.status(400).json({ mensaje: 'Estado inválido' });
      }
      if (err?.code === 'RESERVA_ESTADO_PAGO_INVALIDO') {
        return res.status(400).json({ mensaje: mensajeEstadoPagoInvalido });
      }
      if (err?.code === 'RESERVA_ID_INVALIDO') {
        return res.status(400).json({ mensaje: 'Identificador de reserva inválido' });
      }

      console.error(err);
      return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
  }
);

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
