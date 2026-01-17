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

jest.mock('../models/messages.model', () => ({
  createMessage: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('../config/db', () => ({
  getConnection: jest.fn(),
}));

const { register } = require('../controllers/auth.controller');
const UsuariosModel = require('../models/usuarios.model');
const ClubesModel = require('../models/clubes.model');
const MessagesModel = require('../models/messages.model');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

describe('register controller', () => {
  let statusCode;
  let jsonBody;
  let mockConnection;

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
    mockConnection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
    };
    db.getConnection.mockResolvedValue(mockConnection);
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
    expect(MessagesModel.createMessage).not.toHaveBeenCalled();
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
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
        nombre_club: 'Club Test',
        cuit: '20-12345678-3',
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
    expect(jsonBody.club).toMatchObject({ club_id: 10, nombre: 'Club Test' });
    expect(MessagesModel.createMessage).toHaveBeenCalledWith({
      broadcast: true,
      club_id: 10,
      connection: mockConnection,
      content:
        'Tu club ya está listo. Invita a tu equipo y personaliza tu perfil para comenzar a recibir reservas.',
      sender: 'Sistema',
      title: '¡Bienvenido a MeClub!',
      type: 'info',
    });
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back the transaction when club creation fails', async () => {
    UsuariosModel.buscarPorEmail.mockResolvedValue([]);
    UsuariosModel.crearUsuario.mockResolvedValue({
      usuario_id: 3,
      nombre: 'Club',
      apellido: 'Owner',
      email: 'club-fail@example.com',
      rol: 'club',
    });
    ClubesModel.crearClub.mockRejectedValue(new Error('Club creation failed'));

    const req = {
      body: {
        nombre: 'Club',
        apellido: 'Owner',
        email: 'club-fail@example.com',
        contrasena: '123456',
        rol: 'club',
        nombre_club: 'Club Test',
        cuit: '20-12345678-3',
      },
    };

    await register(req, createResponse());

    expect(statusCode).toBe(500);
    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });
});
