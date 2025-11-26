const express = require('express');
const request = require('supertest');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../middleware/auth.middleware', () => (req, _res, next) => {
  req.usuario = global.__TEST_AUTH_USER__ || { id: 99, rol: 'club' };
  next();
});

jest.mock('../models/canchas.model', () => ({
  obtenerCanchaPorId: jest.fn(),
  listarPorClub: jest.fn(),
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
  misReservas: jest.fn(),
  reservasPorCanchaFecha: jest.fn(),
  reservasAgendaClub: jest.fn(),
  resumenReservasClub: jest.fn(),
  reservasEnCurso: jest.fn(),
  getByIdConClub: jest.fn(),
  updateEstado: jest.fn(),
  eliminar: jest.fn(),
  actualizarEstados: jest.fn(),
  RESERVA_SOLAPADA_CODE: 'RESERVA_SOLAPADA',
  RESERVA_NO_ENCONTRADA_CODE: 'RESERVA_NO_ENCONTRADA',
}));

const ClubesModel = require('../models/clubes.model');
const ReservasModel = require('../models/reservas.model');
const reservasRoutes = require('../routes/reservas.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/reservas', reservasRoutes);
  return app;
};

describe('DELETE /reservas/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.__TEST_AUTH_USER__ = { id: 50, rol: 'club' };
    ClubesModel.obtenerClubPorPropietario.mockImplementation(() =>
      Promise.resolve(global.__TEST_CLUB__ || { club_id: 10 })
    );
    global.__TEST_CLUB__ = { club_id: 10 };
  });

  afterEach(() => {
    global.__TEST_AUTH_USER__ = undefined;
    global.__TEST_CLUB__ = undefined;
  });

  it('rechaza a usuarios sin rol de club', async () => {
    const app = buildApp();
    global.__TEST_AUTH_USER__ = { id: 101, rol: 'usuario' };

    const response = await request(app).delete('/reservas/1');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ mensaje: 'No tienes permisos para esta operación' });
    expect(ReservasModel.getByIdConClub).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el identificador es inválido', async () => {
    const app = buildApp();

    const response = await request(app).delete('/reservas/abc');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ mensaje: 'Identificador de reserva inválido' });
    expect(ReservasModel.getByIdConClub).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la reserva no existe', async () => {
    const app = buildApp();
    ReservasModel.getByIdConClub.mockResolvedValue(null);

    const response = await request(app).delete('/reservas/123');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ mensaje: 'Reserva no encontrada' });
    expect(ReservasModel.eliminar).not.toHaveBeenCalled();
  });

  it('rechaza eliminar reservas de otro club', async () => {
    const app = buildApp();
    ReservasModel.getByIdConClub.mockResolvedValue({ reserva_id: 5, club_id: 20 });

    const response = await request(app).delete('/reservas/5');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ mensaje: 'La reserva no pertenece a tu club' });
    expect(ReservasModel.eliminar).not.toHaveBeenCalled();
  });

  it('elimina la reserva cuando pertenece al club', async () => {
    const app = buildApp();
    ReservasModel.getByIdConClub.mockResolvedValue({ reserva_id: 7, club_id: 10 });
    ReservasModel.eliminar.mockResolvedValue(true);

    const response = await request(app).delete('/reservas/7');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mensaje: 'Reserva eliminada' });
    expect(ReservasModel.eliminar).toHaveBeenCalledWith(
      expect.objectContaining({ reserva_id: 7, club_id: 10 })
    );
  });

  it('propaga un 404 si el modelo informa que no existe', async () => {
    const app = buildApp();
    const error = new Error('Reserva no encontrada');
    error.code = ReservasModel.RESERVA_NO_ENCONTRADA_CODE;
    ReservasModel.getByIdConClub.mockResolvedValue({ reserva_id: 8, club_id: 10 });
    ReservasModel.eliminar.mockRejectedValue(error);

    const response = await request(app).delete('/reservas/8');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ mensaje: 'Reserva no encontrada' });
  });
});

