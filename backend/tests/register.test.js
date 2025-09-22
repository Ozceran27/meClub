jest.mock('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    array: () => [],
  })),
}));

jest.mock('../models/usuarios.model', () => ({
  buscarPorEmail: jest.fn(),
  crearUsuario: jest.fn(),
}));

jest.mock('../models/clubes.model', () => ({
  crearClub: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

const { register } = require('../controllers/auth.controller');
const UsuariosModel = require('../models/usuarios.model');
const ClubesModel = require('../models/clubes.model');
const bcrypt = require('bcryptjs');

describe('register controller', () => {
  let statusCode;
  let jsonBody;

  const createResponse = () => ({
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonBody = payload;
      return this;
    },
  });

  beforeEach(() => {
    statusCode = undefined;
    jsonBody = undefined;
    process.env.JWT_SECRET = 'secret';
    bcrypt.hash.mockResolvedValue('hash');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers a player without creating a club', async () => {
    UsuariosModel.buscarPorEmail.mockResolvedValue([]);
    UsuariosModel.crearUsuario.mockResolvedValue({
      usuario_id: 1,
      nombre: 'Test',
      apellido: 'User',
      email: 'test@example.com',
      rol: 'deportista',
    });
    ClubesModel.crearClub.mockResolvedValue(null);

    const req = {
      body: {
        nombre: 'Test',
        apellido: 'User',
        email: 'test@example.com',
        contrasena: '123456',
      },
    };

    await register(req, createResponse());

    expect(statusCode).toBe(201);
    expect(jsonBody.token).toBeDefined();
    expect(jsonBody.usuario).toMatchObject({
      usuario_id: 1,
      nombre: 'Test',
      apellido: 'User',
      email: 'test@example.com',
      rol: 'deportista',
    });
    expect(jsonBody.club).toBeNull();
  });

  it('registers a club and returns club info', async () => {
    UsuariosModel.buscarPorEmail.mockResolvedValue([]);
    UsuariosModel.crearUsuario.mockResolvedValue({
      usuario_id: 2,
      nombre: 'Club',
      apellido: 'Owner',
      email: 'club@example.com',
      rol: 'club',
    });
    ClubesModel.crearClub.mockResolvedValue({ club_id: 10, nombre: 'Club Test' });

    const req = {
      body: {
        nombre: 'Club',
        apellido: 'Owner',
        email: 'club@example.com',
        contrasena: '123456',
        rol: 'club',
      },
    };

    await register(req, createResponse());

    expect(statusCode).toBe(201);
    expect(jsonBody.token).toBeDefined();
    expect(jsonBody.usuario).toMatchObject({
      usuario_id: 2,
      nombre: 'Club',
      apellido: 'Owner',
      email: 'club@example.com',
      rol: 'club',
    });
    expect(jsonBody.club).toEqual({ club_id: 10, nombre: 'Club Test' });
  });
});

