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

module.exports = router;
