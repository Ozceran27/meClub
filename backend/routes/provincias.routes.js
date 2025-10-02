const express = require('express');
const router = express.Router();

const ProvinciasModel = require('../models/provincias.model');
const LocalidadesModel = require('../models/localidades.model');

router.get('/', async (req, res) => {
  try {
    const provincias = await ProvinciasModel.listar();
    res.json({ provincias });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.get('/:provinciaId/localidades', async (req, res) => {
  try {
    const provinciaId = Number(req.params.provinciaId);
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (!Number.isInteger(provinciaId)) {
      return res.status(400).json({ mensaje: 'provinciaId inválido' });
    }

    const existe = await ProvinciasModel.existe(provinciaId);
    if (!existe) {
      return res.status(404).json({ mensaje: 'Provincia no encontrada' });
    }

    const localidades = await LocalidadesModel.listarPorProvincia(
      provinciaId,
      search || null
    );

    res.json({ provincia_id: provinciaId, localidades });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
