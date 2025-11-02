const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const UsuariosModel = require('../models/usuarios.model');

// Ruta protegida de prueba
router.get('/perfil', verifyToken, (req, res) => {
  res.status(200).json({
    mensaje: 'Acceso autorizado a la ruta protegida',
    usuario: req.usuario, // viene del token
  });
});

/**
 * GET /api/usuarios/buscar
 *
 * Devuelve la lista de jugadores cuyo nombre, apellido, email o teléfono
 * coincidan parcialmente con el término de búsqueda.
 *
 * Errores:
 * - 400: el parámetro `q` es obligatorio y debe tener al menos 3 caracteres.
 * - 429: reservado para cuando se aplique rate limiting a esta ruta.
 */
router.get('/buscar', verifyToken, requireRole('club'), async (req, res) => {
  try {
    const { q = '', limit } = req.query;
    const term = typeof q === 'string' ? q.trim() : '';

    if (term.length < 3) {
      return res
        .status(400)
        .json({ mensaje: 'El término de búsqueda debe tener al menos 3 caracteres' });
    }

    const parsedLimit = Number.parseInt(limit, 10);
    const finalLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 25) : 10;

    const usuarios = await UsuariosModel.buscarJugadores({ term, limit: finalLimit });
    res.json({
      usuarios: usuarios.map(({ usuario_id, nombre, apellido, telefono }) => ({
        usuario_id,
        nombre,
        apellido,
        telefono,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;

