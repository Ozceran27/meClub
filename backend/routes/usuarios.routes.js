const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth.middleware');

// Ruta protegida de prueba
router.get('/perfil', verifyToken, (req, res) => {
  res.status(200).json({
    mensaje: 'Acceso autorizado a la ruta protegida',
    usuario: req.usuario, // viene del token
  });
});

module.exports = router;

