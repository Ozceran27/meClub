const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Registro de usuario
router.post('/register', authController.register);

// Login de usuario
router.post('/login', authController.login);

// Olvidé mi contraseña (solicitud de reseteo)
router.post('/forgot', authController.forgot);

// Reset de contraseña con token de un solo uso
router.post('/reset', authController.reset);

module.exports = router;
