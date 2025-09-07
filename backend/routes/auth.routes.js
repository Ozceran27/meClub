const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Registro de usuario
router.post(
  '/register',
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
  [
    check('email').isEmail().withMessage('Email inválido'),
    check('contrasena').notEmpty().withMessage('Contraseña requerida'),
  ],
  authController.login
);

// Olvidé mi contraseña (solicitud de reseteo)
router.post(
  '/forgot',
  [check('email').isEmail().withMessage('Email inválido')],
  authController.forgot
);

// Reset de contraseña con token de un solo uso
router.post(
  '/reset',
  [
    check('token').notEmpty().withMessage('Token requerido'),
    check('password')
      .isLength({ min: 6 })
      .withMessage('Contraseña mínima de 6 caracteres'),
  ],
  authController.reset
);

module.exports = router;
