const express = require('express');
const router = express.Router();
const NivelesModel = require('../models/niveles.model');

router.get('/', async (_req, res) => {
  try {
    const data = await NivelesModel.listar();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
