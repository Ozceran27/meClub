const express = require('express');
const router = express.Router();
const DeportesModel = require('../models/deportes.model');

router.get('/', async (_req, res) => {
  try {
    const deportes = await DeportesModel.listar();
    res.json(deportes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
