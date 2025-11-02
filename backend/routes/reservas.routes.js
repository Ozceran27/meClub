const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const ReservasModel = require('../models/reservas.model');
const CanchasModel = require('../models/canchas.model');
const TarifasModel = require('../models/tarifas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const { diaSemana1a7, addHoursHHMMSS, isPastDateTime } = require('../utils/datetime');
const { getUserId } = require('../utils/auth');
const { esEstadoReservaActivo } = require('../constants/reservasEstados');
// -----------------------------------------------------------------------------------------------

// POST crear reserva
router.post('/', verifyToken, async (req, res) => {
  try {
    const { cancha_id, fecha, hora_inicio, duracion_horas = 1, grabacion_solicitada, monto } = req.body;

    if (!cancha_id || !fecha || !hora_inicio) {
      return res.status(400).json({ mensaje: 'Faltan campos requeridos (cancha_id, fecha, hora_inicio)' });
    }
    if (!Number.isInteger(duracion_horas) || duracion_horas < 1 || duracion_horas > 8) {
      return res.status(400).json({ mensaje: 'duracion_horas debe ser entero entre 1 y 8' });
    }
    if (isPastDateTime(fecha, hora_inicio)) {
      return res.status(400).json({ mensaje: 'No se puede reservar en el pasado' });
    }

    const hora_fin = addHoursHHMMSS(hora_inicio, duracion_horas);
    if (!hora_fin) return res.status(400).json({ mensaje: 'hora_inicio inválida' });

    const cancha = await CanchasModel.obtenerCanchaPorId(cancha_id);
    if (!cancha) return res.status(404).json({ mensaje: 'Cancha no encontrada' });

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

    // Solapes
    const haySolape = await ReservasModel.existeSolape({ cancha_id, fecha, hora_inicio, hora_fin });
    if (haySolape) {
      return res.status(409).json({ mensaje: 'El horario solicitado se solapa con otra reserva' });
    }

    // Precio
    let total = null;
    if (monto != null) {
      // Si lo envían manual (p.ej. checkout externo) respetamos
      total = Number(monto);
    } else {
      // Busca tarifa aplicable; si no hay, usa precio base de la cancha
      const tarifa = await TarifasModel.obtenerTarifaAplicable(cancha.club_id, dia, hora_inicio, hora_fin);
      const precioHora = tarifa ? Number(tarifa.precio) : Number(cancha.precio || 0);
      total = precioHora * Number(duracion_horas);
    }

    const usuarioId = getUserId(req.usuario);
    if (!usuarioId) return res.status(401).json({ mensaje: 'Token sin identificador de usuario' });

    const reserva = await ReservasModel.crear({
      usuario_id: usuarioId,
      cancha_id,
      fecha,
      hora_inicio,
      hora_fin,
      duracion_horas,
      monto: total,
      grabacion_solicitada
    });

    return res.status(201).json({ mensaje: 'Reserva creada', reserva });
  } catch (err) {
    if (err && err.code === ReservasModel.RESERVA_SOLAPADA_CODE) {
      return res.status(409).json({ mensaje: 'El horario solicitado se solapa con otra reserva' });
    }

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
      const ClubesModel = require('../models/clubes.model');
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
