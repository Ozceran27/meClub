const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');

const ClubesModel = require('../models/clubes.model');
const CanchasModel = require('../models/canchas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const ReservasModel = require('../models/reservas.model');
const TarifasModel = require('../models/tarifas.model');

// Normaliza id del token
const getUserId = (u) => u?.id ?? u?.usuario_id;

// ---------------- Mis datos
router.get('/mis-datos', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const club = await ClubesModel.obtenerClubPorPropietario(getUserId(req.usuario));
    if (!club) return res.status(404).json({ mensaje: 'No tienes club relacionado' });
    res.json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (listar)
router.get('/mis-canchas', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const club = await ClubesModel.obtenerClubPorPropietario(getUserId(req.usuario));
    if (!club) return res.status(404).json({ mensaje: 'No tienes club relacionado' });

    const canchas = await ClubesModel.obtenerMisCanchas(club.club_id);
    res.json({ club, canchas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (crear)
router.post('/mis-canchas', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const club = await ClubesModel.obtenerClubPorPropietario(getUserId(req.usuario));
    if (!club) return res.status(404).json({ mensaje: 'No tienes club relacionado' });

    const { nombre, deporte_id, capacidad, precio, techada = 0, iluminacion = 0 } = req.body;
    if (!nombre || !deporte_id || !capacidad || !precio) {
      return res.status(400).json({ mensaje: 'Faltan campos requeridos' });
    }

    const cancha = await CanchasModel.crearCancha({
      club_id: club.club_id, nombre, deporte_id, capacidad, precio, techada, iluminacion,
    });

    res.status(201).json({ mensaje: 'Cancha creada', cancha });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Público: info club + canchas
router.get('/publico/:club_id', async (req, res) => {
  try {
    const { club_id } = req.params;
    const club = await ClubesModel.obtenerClubPorId(club_id);
    if (!club) return res.status(404).json({ mensaje: 'Club no encontrado' });

    const canchas = await CanchasModel.listarPorClub(club_id);
    res.json({ club, canchas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Resumen por club
router.get('/:club_id/resumen', async (req, res) => {
  try {
    const { club_id } = req.params;
    const club = await ClubesModel.obtenerClubPorId(club_id);
    if (!club) return res.status(404).json({ mensaje: 'Club no encontrado' });

    const data = await ClubesModel.obtenerResumen(club_id);
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Panel club: reservas por cancha/fecha
router.get('/canchas/:cancha_id/reservas', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const { cancha_id } = req.params;
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ mensaje: 'Parámetro "fecha" es requerido (YYYY-MM-DD)' });

    const club = await ClubesModel.obtenerClubPorPropietario(getUserId(req.usuario));
    if (!club) return res.status(404).json({ mensaje: 'No tienes club relacionado' });

    const esPropia = await CanchasModel.perteneceAClub(cancha_id, club.club_id);
    if (!esPropia) return res.status(403).json({ mensaje: 'No tienes permisos sobre esta cancha' });

    const reservas = await ReservasModel.reservasPorCanchaFecha(cancha_id, fecha);
    res.json({ cancha_id: Number(cancha_id), fecha, reservas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis horarios (listar)
router.get('/mis-horarios', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const club = await ClubesModel.obtenerClubPorPropietario(getUserId(req.usuario));
    if (!club) return res.status(404).json({ mensaje: 'No tienes club relacionado' });

    const horarios = await ClubesHorarioModel.listarPorClub(club.club_id);
    res.json({ club_id: club.club_id, horarios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis horarios (upsert por día)
router.patch('/mis-horarios', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items || items.length === 0) {
      return res.status(400).json({ mensaje: 'Se requiere items[] con horarios' });
    }

    const club = await ClubesModel.obtenerClubPorPropietario(getUserId(req.usuario));
    if (!club) return res.status(404).json({ mensaje: 'No tienes club relacionado' });

    for (const it of items) {
      const { dia_semana, abre, cierra, activo = 1 } = it || {};
      if (!Number.isInteger(dia_semana) || dia_semana < 1 || dia_semana > 7 || !abre || !cierra) {
        return res.status(400).json({ mensaje: 'Cada item debe incluir dia_semana(1..7), abre y cierra' });
      }
      await ClubesHorarioModel.upsertDia({ club_id: club.club_id, dia_semana, abre, cierra, activo });
    }

    const horarios = await ClubesHorarioModel.listarPorClub(club.club_id);
    res.json({ mensaje: 'Horarios actualizados', horarios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis tarifas (listar)
router.get('/mis-tarifas', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const club = await ClubesModel.obtenerClubPorPropietario(getUserId(req.usuario));
    if (!club) return res.status(404).json({ mensaje: 'No tienes club relacionado' });
    const dia = req.query.dia ? parseInt(req.query.dia, 10) : null;
    const tarifas = await TarifasModel.listarPorClub(club.club_id, Number.isInteger(dia) ? dia : null);
    res.json({ club_id: club.club_id, tarifas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis tarifas (upsert en bulk)
router.patch('/mis-tarifas', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const club = await ClubesModel.obtenerClubPorPropietario(getUserId(req.usuario));
    if (!club) return res.status(404).json({ mensaje: 'No tienes club relacionado' });

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ mensaje: 'Debes enviar items[]' });
    }

    await TarifasModel.upsertItems(club.club_id, items);
    const tarifas = await TarifasModel.listarPorClub(club.club_id);
    res.json({ mensaje: 'Tarifas actualizadas', tarifas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
