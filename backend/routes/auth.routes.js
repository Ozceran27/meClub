const express = require('express');
const rateLimit = require('express-rate-limit');
const { check } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { buildSingleUploadMiddleware } = require('../middleware/logoUpload.middleware');

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res
      .status(429)
      .json({ mensaje: 'Demasiadas solicitudes. Intenta nuevamente en unos instantes.' }),
});

const uploadRegisterLogo = buildSingleUploadMiddleware('logo');

// Registro de usuario
router.post(
  '/register',
  authLimiter,
  uploadRegisterLogo,
  [
    check('nombre').notEmpty().withMessage('Nombre requerido'),
    check('apellido').notEmpty().withMessage('Apellido requerido'),
    check('email').isEmail().withMessage('Email inválido'),
    check('contrasena')
      .isLength({ min: 6 })
      .withMessage('Contraseña mínima de 6 caracteres'),
  ],
  authController.register
);

// Login de usuario
router.post(
  '/login',
  authLimiter,
  [
    check('email').isEmail().withMessage('Email inválido'),
    check('contrasena').notEmpty().withMessage('Contraseña requerida'),
  ],
  authController.login
);

// Olvidé mi contraseña (solicitud de reseteo)
router.post(
  '/forgot',
  authLimiter,
  [check('email').isEmail().withMessage('Email inválido')],
  authController.forgot
);

// Reset de contraseña con token de un solo uso
router.post(
  '/reset',
  authLimiter,
  [
    check('token').notEmpty().withMessage('Token requerido'),
    check('password')
      .isLength({ min: 6 })
      .withMessage('Contraseña mínima de 6 caracteres'),
  ],
  authController.reset
);

module.exports = router;
