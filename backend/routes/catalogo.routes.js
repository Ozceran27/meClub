const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const ServiciosModel = require('../models/servicios.model');

router.get('/servicios', verifyToken, requireRole('club'), async (_req, res) => {
  try {
    const servicios = await ServiciosModel.listarDisponibles();
    res.json({ servicios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
