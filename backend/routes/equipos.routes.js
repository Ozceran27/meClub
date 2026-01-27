const express = require('express');
const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const EquiposModel = require('../models/equipos.model');

const router = express.Router();

/**
 * GET /api/equipos/buscar
 *
 * Devuelve equipos activos que coinciden parcialmente con el término de búsqueda.
 *
 * Errores:
 * - 400: el parámetro `q` es obligatorio y debe tener al menos 2 caracteres.
 * - 429: reservado para cuando se aplique rate limiting a esta ruta.
 */
router.get('/buscar', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const { q = '', limit, club_id } = req.query;
    const term = typeof q === 'string' ? q.trim() : '';

    if (term.length < 2) {
      return res
        .status(400)
        .json({ mensaje: 'El término de búsqueda debe tener al menos 2 caracteres' });
    }

    const parsedLimit = Number.parseInt(limit, 10);
    const finalLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 25) : 10;

    const parsedClubId = Number.parseInt(club_id, 10);
    const clubId = Number.isInteger(parsedClubId) && parsedClubId > 0 ? parsedClubId : null;

    const equipos = await EquiposModel.buscarPorNombre({ term, limit: finalLimit, clubId });
    res.json({
      equipos: equipos.map(({ equipo_id, nombre, descripcion, club_id: equipoClubId }) => ({
        equipo_id,
        nombre,
        descripcion,
        club_id: equipoClubId,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
