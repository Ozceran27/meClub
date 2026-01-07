const express = require('express');
const request = require('supertest');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../middleware/auth.middleware', () => (req, _res, next) => {
  req.usuario = global.__TEST_AUTH_USER__ || { id: 101, rol: 'usuario' };
  next();
});

jest.mock('../middleware/roles.middleware', () => ({
  requireRole: () => (_req, _res, next) => next(),
}));

jest.mock('../middleware/club.middleware', () => (req, _res, next) => {
  if (global.__TEST_CLUB__) req.club = global.__TEST_CLUB__;
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
  obtenerClubPorPropietario: jest.fn(),
}));

jest.mock('../models/usuarios.model', () => ({
  buscarPorId: jest.fn(),
}));

jest.mock('../models/reservas.model', () => ({
  existeSolape: jest.fn(),
  crear: jest.fn(),
  RESERVA_SOLAPADA_CODE: 'RESERVA_SOLAPADA',
}));

const CanchasModel = require('../models/canchas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const ClubesModel = require('../models/clubes.model');
const ReservasModel = require('../models/reservas.model');
const reservasRoutes = require('../routes/reservas.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/reservas', reservasRoutes);
  return app;
};

describe('POST /reservas con horarios nocturnos', () => {
  const baseClub = { club_id: 50, precio_grabacion: 0 };
  const baseCancha = {
    cancha_id: 1,
    club_id: baseClub.club_id,
    precio_dia: 1000,
    precio_noche: 1500,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.__TEST_AUTH_USER__ = { id: 700, rol: 'usuario' };
    global.__TEST_CLUB__ = baseClub;

    CanchasModel.obtenerCanchaPorId.mockResolvedValue(baseCancha);
    ClubesHorarioModel.getPorClubYDia.mockResolvedValue({ abre: '18:00:00', cierra: '02:00:00', activo: true });
    ClubesModel.obtenerClubPorId.mockResolvedValue(baseClub);
    ClubesModel.obtenerClubPorPropietario.mockResolvedValue(baseClub);
    ReservasModel.existeSolape.mockResolvedValue(false);
    ReservasModel.crear.mockImplementation((payload) => Promise.resolve({ reserva_id: 999, ...payload }));
  });

  afterEach(() => {
    global.__TEST_AUTH_USER__ = undefined;
    global.__TEST_CLUB__ = undefined;
  });

  it('acepta reservas que terminan después de medianoche cuando el club cierra al día siguiente', async () => {
    const app = buildApp();

    const response = await request(app).post('/reservas').send({
      cancha_id: baseCancha.cancha_id,
      fecha: '2999-12-30',
      hora_inicio: '23:00:00',
      duracion_horas: 3,
    });

    expect(response.status).toBe(201);
    expect(response.body.mensaje).toBe('Reserva creada');
    expect(ReservasModel.crear).toHaveBeenCalledWith(
      expect.objectContaining({ hora_inicio: '23:00:00', hora_fin: '02:00:00' })
    );
  });

  it('rechaza reservas que exceden el horario nocturno', async () => {
    const app = buildApp();

    const response = await request(app).post('/reservas').send({
      cancha_id: baseCancha.cancha_id,
      fecha: '2999-12-30',
      hora_inicio: '23:30:00',
      duracion_horas: 4,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ mensaje: 'Reserva fuera del horario comercial del club' });
    expect(ReservasModel.crear).not.toHaveBeenCalled();
  });
});
