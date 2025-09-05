const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const loadClub = require('../middleware/club.middleware');

const ClubesModel = require('../models/clubes.model');
const CanchasModel = require('../models/canchas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const ReservasModel = require('../models/reservas.model');
const TarifasModel = require('../models/tarifas.model');

// Aplica middlewares de autenticación/rol y carga de club
router.use(['/mis-datos', '/mis-canchas', '/canchas', '/mis-horarios', '/mis-tarifas'], verifyToken, requireRole('club'), loadClub);

// ---------------- Mis datos
router.get('/mis-datos', (req, res) => {
  res.json(req.club);
});

// ---------------- Mis canchas (listar)
router.get('/mis-canchas', async (req, res) => {
  try {
    const canchas = await ClubesModel.obtenerMisCanchas(req.club.club_id);
    res.json({ club: req.club, canchas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (crear)
router.post('/mis-canchas', async (req, res) => {
  try {
    const { nombre, deporte_id, capacidad, precio, techada = 0, iluminacion = 0 } = req.body;
    if (!nombre || !deporte_id || !capacidad || !precio) {
      return res.status(400).json({ mensaje: 'Faltan campos requeridos' });
    }

    const cancha = await CanchasModel.crearCancha({
      club_id: req.club.club_id,
      nombre,
      deporte_id,
      capacidad,
      precio,
      techada,
      iluminacion,
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
router.get('/canchas/:cancha_id/reservas', async (req, res) => {
  try {
    const { cancha_id } = req.params;
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ mensaje: 'Parámetro "fecha" es requerido (YYYY-MM-DD)' });

    const esPropia = await CanchasModel.perteneceAClub(cancha_id, req.club.club_id);
    if (!esPropia) return res.status(403).json({ mensaje: 'No tienes permisos sobre esta cancha' });

    const reservas = await ReservasModel.reservasPorCanchaFecha(cancha_id, fecha);
    res.json({ cancha_id: Number(cancha_id), fecha, reservas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis horarios (listar)
router.get('/mis-horarios', async (req, res) => {
  try {
    const horarios = await ClubesHorarioModel.listarPorClub(req.club.club_id);
    res.json({ club_id: req.club.club_id, horarios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis horarios (upsert por día)
router.patch('/mis-horarios', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items || items.length === 0) {
      return res.status(400).json({ mensaje: 'Se requiere items[] con horarios' });
    }

    for (const it of items) {
      const { dia_semana, abre, cierra, activo = 1 } = it || {};
      if (!Number.isInteger(dia_semana) || dia_semana < 1 || dia_semana > 7 || !abre || !cierra) {
        return res.status(400).json({ mensaje: 'Cada item debe incluir dia_semana(1..7), abre y cierra' });
      }
      await ClubesHorarioModel.upsertDia({ club_id: req.club.club_id, dia_semana, abre, cierra, activo });
    }

    const horarios = await ClubesHorarioModel.listarPorClub(req.club.club_id);
    res.json({ mensaje: 'Horarios actualizados', horarios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis tarifas (listar)
router.get('/mis-tarifas', async (req, res) => {
  try {
    const dia = req.query.dia ? parseInt(req.query.dia, 10) : null;
    const tarifas = await TarifasModel.listarPorClub(
      req.club.club_id,
      Number.isInteger(dia) ? dia : null
    );
    res.json({ club_id: req.club.club_id, tarifas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis tarifas (upsert en bulk)
router.patch('/mis-tarifas', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ mensaje: 'Debes enviar items[]' });
    }

    await TarifasModel.upsertItems(req.club.club_id, items);
    const tarifas = await TarifasModel.listarPorClub(req.club.club_id);
    res.json({ mensaje: 'Tarifas actualizadas', tarifas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
