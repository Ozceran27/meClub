const assert = require('assert');
const { register } = require('../controllers/auth.controller');
const UsuariosModel = require('../models/usuarios.model');
const ClubesModel = require('../models/clubes.model');
const bcrypt = require('bcryptjs');

(async () => {
  // Preparar mocks
  UsuariosModel.buscarPorEmail = async () => [];
  UsuariosModel.crearUsuario = async (u) => ({
    usuario_id: 1,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    rol: u.rol,
  });
  ClubesModel.crearClub = async () => null;
  bcrypt.hash = async () => 'hash';

  process.env.JWT_SECRET = 'secret';

  let statusCode = 0;
  let jsonBody = null;
  const req = {
    body: { nombre: 'Test', apellido: 'User', email: 'test@example.com', contrasena: '1234' },
  };
  const res = {
    status(code) { statusCode = code; return this; },
    json(obj) { jsonBody = obj; },
  };

  await register(req, res);

  assert.strictEqual(statusCode, 201);
  assert.ok(jsonBody.token, 'token should be returned');
  assert.ok(jsonBody.usuario, 'usuario should be returned');
  console.log('register returned { token, usuario }');
})();
