const express = require('express');
const request = require('supertest');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../middleware/auth.middleware', () => (req, _res, next) => {
  req.usuario = { id: 77, rol: 'usuario' };
  next();
});

jest.mock('../models/canchas.model', () => ({
  obtenerCanchaPorId: jest.fn(),
}));

jest.mock('../models/tarifas.model', () => ({
  obtenerTarifaAplicable: jest.fn(),
}));

jest.mock('../models/clubesHorario.model', () => ({
  getPorClubYDia: jest.fn(),
}));

jest.mock('../models/clubes.model', () => ({
  obtenerClubPorId: jest.fn(),
}));

const db = require('../config/db');
const CanchasModel = require('../models/canchas.model');
const TarifasModel = require('../models/tarifas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const ClubesModel = require('../models/clubes.model');
const reservasRoutes = require('../routes/reservas.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/reservas', reservasRoutes);
  return app;
};

const createConnectionMock = ({ conflict }) => {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn().mockResolvedValue(),
  };

  connection.query.mockImplementation((sql, params = []) => {
    if (sql.startsWith('SELECT r.reserva_id') && sql.includes('FOR UPDATE')) {
      if (conflict) {
        return Promise.resolve([[{ reserva_id: 999 }], []]);
      }
      return Promise.resolve([[], []]);
    }

    if (sql.startsWith('INSERT INTO reservas')) {
      return Promise.resolve([{ insertId: conflict ? 2 : 1 }, []]);
    }

    if (sql.startsWith('SELECT usuario_id FROM clubes')) {
      return Promise.resolve([[{ usuario_id: 10 }], []]);
    }

    if (sql.startsWith('SELECT usuario_id FROM clubs_usuarios')) {
      return Promise.resolve([[{ usuario_id: 11 }], []]);
    }

    if (sql.startsWith('INSERT INTO messages')) {
      return Promise.resolve([{ insertId: 900 }]);
    }

    if (sql.startsWith('INSERT INTO user_inbox')) {
      return Promise.resolve([{}]);
    }

    return Promise.reject(new Error(`SQL no mockeado en conexión: ${sql}`));
  });

  return connection;
};

describe('ReservasModel.crear con transacción', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    CanchasModel.obtenerCanchaPorId.mockResolvedValue({
      cancha_id: 8,
      club_id: 2,
      nombre: 'Cancha Norte',
      precio: 1500,
    });
    TarifasModel.obtenerTarifaAplicable.mockResolvedValue(null);
    ClubesHorarioModel.getPorClubYDia.mockResolvedValue({
      activo: true,
      abre: '08:00:00',
      cierra: '22:00:00',
    });
    ClubesModel.obtenerClubPorId.mockResolvedValue({
      club_id: 2,
      precio_grabacion: null,
    });

    db.query.mockImplementation((sql) => {
      if (sql.startsWith('SELECT r.reserva_id') && sql.includes('FROM reservas r')) {
        return Promise.resolve([[], []]);
      }
      return Promise.reject(new Error(`Query no mockeada: ${sql}`));
    });
  });

  it('retorna 409 cuando el SELECT FOR UPDATE detecta un solape concurrente', async () => {
    const primeraConexion = createConnectionMock({ conflict: false });
    const segundaConexion = createConnectionMock({ conflict: true });
    const conexiones = [primeraConexion, segundaConexion];

    db.getConnection.mockImplementation(() => {
      const conn = conexiones.shift();
      if (!conn) throw new Error('Sin conexiones mockeadas disponibles');
      return Promise.resolve(conn);
    });

    const app = buildApp();
    const payload = {
      cancha_id: 8,
      fecha: '2099-05-05',
      hora_inicio: '09:00:00',
      duracion_horas: 2,
      grabacion_solicitada: false,
    };

    const primerIntento = await request(app).post('/reservas').send(payload);
    expect(primerIntento.status).toBe(201);

    const segundoIntento = await request(app).post('/reservas').send(payload);
    expect(segundoIntento.status).toBe(409);
    expect(segundoIntento.body.mensaje).toMatch(/solapa/i);

    expect(primerIntento.body.reserva).toMatchObject({
      cancha_id: 8,
      fecha: '2099-05-05',
      hora_inicio: '09:00:00',
    });

    expect(primeraConexion.beginTransaction).toHaveBeenCalledTimes(1);
    expect(primeraConexion.commit).toHaveBeenCalledTimes(1);
    expect(primeraConexion.rollback).not.toHaveBeenCalled();
    expect(primeraConexion.release).toHaveBeenCalledTimes(1);

    expect(segundaConexion.beginTransaction).toHaveBeenCalledTimes(1);
    expect(segundaConexion.rollback).toHaveBeenCalledTimes(1);
    expect(segundaConexion.commit).not.toHaveBeenCalled();
    expect(segundaConexion.release).toHaveBeenCalledTimes(1);
  });
});
