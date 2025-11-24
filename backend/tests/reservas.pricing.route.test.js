const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth.middleware', () => (req, _res, next) => {
  req.usuario = { id: 900, rol: 'club' };
  next();
});

jest.mock('../middleware/roles.middleware', () => ({
  requireRole: () => (_req, _res, next) => next(),
}));

jest.mock('../middleware/club.middleware', () => (req, _res, next) => {
  req.club = global.__TEST_CLUB__ || {
    club_id: 10,
    precio_grabacion: 0,
    hora_nocturna_inicio: '22:00:00',
    hora_nocturna_fin: '06:00:00',
  };
  next();
});

jest.mock('../models/reservas.model', () => ({
  existeSolape: jest.fn(),
  crear: jest.fn(),
}));

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

const ReservasModel = require('../models/reservas.model');
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

describe('POST /reservas pricing coherency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ReservasModel.existeSolape.mockResolvedValue(false);
    ClubesHorarioModel.getPorClubYDia.mockResolvedValue({ activo: true, abre: '08:00:00', cierra: '23:59:59' });
    ClubesModel.obtenerClubPorId.mockResolvedValue(null);
    ClubesModel.obtenerClubPorPropietario.mockResolvedValue(null);
  });

  it('aplica la tarifa horaria del club y expone el contexto de pricing', async () => {
    const app = buildApp();

    global.__TEST_CLUB__ = {
      club_id: 10,
      precio_grabacion: 0,
      hora_nocturna_inicio: '21:30:00',
      hora_nocturna_fin: '06:00:00',
    };

    CanchasModel.obtenerCanchaPorId.mockResolvedValue({
      cancha_id: 5,
      club_id: 10,
      precio: 2000,
      precio_dia: 2400,
      precio_noche: 2600,
    });

    TarifasModel.obtenerTarifaAplicable.mockResolvedValue({
      tarifa_id: 77,
      precio: 1500,
      hora_desde: '08:00:00',
      hora_hasta: '18:00:00',
      dia_semana: 2,
    });

    ReservasModel.crear.mockImplementation(async (data) => ({ reserva_id: 999, ...data }));

    const payload = {
      cancha_id: 5,
      fecha: '2099-01-05',
      hora_inicio: '10:00:00',
      duracion_horas: 2,
      tipo_reserva: 'privada',
      contacto_nombre: 'Ana',
      contacto_apellido: 'Martínez',
      contacto_telefono: '555-5555',
    };

    const response = await request(app).post('/reservas').send(payload);

    expect(response.status).toBe(201);
    expect(response.body.reserva).toMatchObject({
      monto_base: 3000,
      monto: 3000,
      precio_hora_aplicado: 1500,
      tarifa_aplicada: { tarifa_id: 77, precio: 1500 },
    });

    expect(response.body.pricing).toEqual({
      precio_por_hora: 1500,
      rango_nocturno: { start: '21:30:00', end: '06:00:00' },
      tarifa_aplicada: { tarifa_id: 77, precio: 1500 },
    });

    expect(ReservasModel.crear).toHaveBeenCalledWith(
      expect.objectContaining({ monto_base: 3000, monto: 3000, monto_grabacion: 0 })
    );
  });

  it('usa el precio nocturno de la cancha cuando no hay tarifa y añade la grabación', async () => {
    const app = buildApp();

    global.__TEST_CLUB__ = {
      club_id: 11,
      precio_grabacion: 400,
      configuracion_nocturna: [{ inicio: '22:00', fin: '05:00' }],
    };

    CanchasModel.obtenerCanchaPorId.mockResolvedValue({
      cancha_id: 6,
      club_id: 11,
      precio_dia: 2200,
      precio_noche: 2600,
    });

    TarifasModel.obtenerTarifaAplicable.mockResolvedValue(null);
    ReservasModel.crear.mockImplementation(async (data) => ({ reserva_id: 1000, ...data }));

    const response = await request(app)
      .post('/reservas')
      .send({
        cancha_id: 6,
        fecha: '2099-01-06',
        hora_inicio: '22:30:00',
        duracion_horas: 1,
        grabacion_solicitada: true,
        tipo_reserva: 'privada',
        contacto_nombre: 'Nocturna',
        contacto_apellido: 'Test',
        contacto_telefono: '123123',
      });

    expect(response.status).toBe(201);
    expect(response.body.reserva).toMatchObject({
      monto_base: 2600,
      monto_grabacion: 400,
      monto: 3000,
      precio_hora_aplicado: 2600,
      tarifa_aplicada: null,
      rango_nocturno_aplicado: { start: '22:00:00', end: '05:00:00' },
    });

    expect(response.body.pricing).toEqual({
      precio_por_hora: 2600,
      rango_nocturno: { start: '22:00:00', end: '05:00:00' },
      tarifa_aplicada: null,
    });

    expect(ReservasModel.crear).toHaveBeenCalledWith(
      expect.objectContaining({ monto_base: 2600, monto_grabacion: 400, monto: 3000 })
    );
  });
});

