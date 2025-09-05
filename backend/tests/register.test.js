const assert = require('assert');
const { register } = require('../controllers/auth.controller');
const UsuariosModel = require('../models/usuarios.model');
const ClubesModel = require('../models/clubes.model');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'secret';
bcrypt.hash = async () => 'hash';

(async () => {
  // Caso 1: registro de deportista (sin club)
  UsuariosModel.buscarPorEmail = async () => [];
  UsuariosModel.crearUsuario = async (u) => ({
    usuario_id: 1,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    rol: u.rol,
  });
  ClubesModel.crearClub = async () => null;

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
  assert.strictEqual(jsonBody.club, null, 'club should be null for deportista');
  console.log('register returned { token, usuario, club:null }');

  // Caso 2: registro de club
  UsuariosModel.buscarPorEmail = async () => [];
  UsuariosModel.crearUsuario = async (u) => ({
    usuario_id: 2,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    rol: u.rol,
  });
  ClubesModel.crearClub = async () => ({ club_id: 10, nombre: 'Club Test' });

  statusCode = 0;
  jsonBody = null;
  const reqClub = {
    body: {
      nombre: 'Club',
      apellido: 'Owner',
      email: 'club@example.com',
      contrasena: '1234',
      rol: 'club',
    },
  };
  await register(reqClub, res);

  assert.strictEqual(statusCode, 201);
  assert.ok(jsonBody.token, 'token should be returned');
  assert.ok(jsonBody.usuario, 'usuario should be returned');
  assert.deepStrictEqual(jsonBody.club, { club_id: 10, nombre: 'Club Test' });
  console.log('register returned { token, usuario, club } for club role');
})();
