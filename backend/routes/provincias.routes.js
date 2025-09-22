const express = require('express');
const router = express.Router();

const ProvinciasModel = require('../models/provincias.model');

router.get('/', async (req, res) => {
  try {
    const provincias = await ProvinciasModel.listar();
    res.json({ provincias });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
