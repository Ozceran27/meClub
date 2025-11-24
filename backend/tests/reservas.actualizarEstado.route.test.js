const express = require('express');
const request = require('supertest');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../middleware/auth.middleware', () => (req, _res, next) => {
  req.usuario = global.__TEST_AUTH_USER__ || { id: 90, rol: 'club' };
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

describe('PATCH /reservas/:id/estado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.__TEST_AUTH_USER__ = { id: 55, rol: 'club' };
    global.__TEST_CLUB__ = { club_id: 10 };
    ClubesModel.obtenerClubPorPropietario.mockImplementation(() =>
      Promise.resolve(global.__TEST_CLUB__)
    );
  });

  afterEach(() => {
    global.__TEST_AUTH_USER__ = undefined;
    global.__TEST_CLUB__ = undefined;
  });

  it('rechaza a usuarios sin rol de club', async () => {
    const app = buildApp();
    global.__TEST_AUTH_USER__ = { id: 1, rol: 'usuario' };

    const response = await request(app)
      .patch('/reservas/1/estado')
      .send({ estado: 'pagada' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ mensaje: 'No tienes permisos para esta operación' });
    expect(ReservasModel.getByIdConClub).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el identificador es inválido', async () => {
    const app = buildApp();

    const response = await request(app)
      .patch('/reservas/abc/estado')
      .send({ estado: 'pagada' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ mensaje: 'Identificador de reserva inválido' });
    expect(ReservasModel.getByIdConClub).not.toHaveBeenCalled();
  });

  it('devuelve 400 si no se envían campos a actualizar', async () => {
    const app = buildApp();

    const response = await request(app).patch('/reservas/5/estado').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ mensaje: 'Debes enviar al menos un campo (estado o estado_pago)' });
    expect(ReservasModel.getByIdConClub).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el estado es inválido', async () => {
    const app = buildApp();

    const response = await request(app)
      .patch('/reservas/5/estado')
      .send({ estado: 'no_valido' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ mensaje: 'Estado inválido' });
    expect(ReservasModel.getByIdConClub).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el estado de pago es inválido', async () => {
    const app = buildApp();

    const response = await request(app)
      .patch('/reservas/5/estado')
      .send({ estado_pago: 'otro' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      mensaje: 'Estado de pago inválido. Valores permitidos: pendiente_pago, senado, pagado, cancelado',
    });
    expect(ReservasModel.getByIdConClub).not.toHaveBeenCalled();
  });

  it('devuelve 404 cuando la reserva no existe', async () => {
    const app = buildApp();
    ReservasModel.getByIdConClub.mockResolvedValue(null);

    const response = await request(app)
      .patch('/reservas/5/estado')
      .send({ estado: 'pagada' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ mensaje: 'Reserva no encontrada' });
    expect(ReservasModel.actualizarEstados).not.toHaveBeenCalled();
  });

  it('devuelve 403 si la reserva no pertenece al club', async () => {
    const app = buildApp();
    ReservasModel.getByIdConClub.mockResolvedValue({ reserva_id: 5, club_id: 20 });

    const response = await request(app)
      .patch('/reservas/5/estado')
      .send({ estado: 'pagada' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ mensaje: 'La reserva no pertenece a tu club' });
    expect(ReservasModel.actualizarEstados).not.toHaveBeenCalled();
  });

  it('actualiza el estado y responde con la reserva modificada', async () => {
    const app = buildApp();
    ReservasModel.getByIdConClub.mockResolvedValue({
      reserva_id: 5,
      club_id: 10,
      estado: 'pendiente',
      estado_pago: 'pendiente_pago',
    });
    ReservasModel.actualizarEstados.mockResolvedValue({
      updated: true,
      estado: 'pagada',
      estado_pago: 'pagado',
    });

    const response = await request(app)
      .patch('/reservas/5/estado')
      .send({ estado: 'pagada', estado_pago: 'pagado' });

    expect(response.status).toBe(200);
    expect(ReservasModel.actualizarEstados).toHaveBeenCalledWith({
      reserva_id: 5,
      estado: 'pagada',
      estado_pago: 'pagado',
    });
    expect(response.body).toEqual({
      mensaje: 'Estado de reserva actualizado',
      reserva: {
        reserva_id: 5,
        club_id: 10,
        estado: 'pagada',
        estado_pago: 'pagado',
      },
    });
  });

  it('normaliza valores antes de actualizar', async () => {
    const app = buildApp();
    ReservasModel.getByIdConClub.mockResolvedValue({
      reserva_id: 6,
      club_id: 10,
      estado: 'pendiente',
      estado_pago: 'pendiente_pago',
    });
    ReservasModel.actualizarEstados.mockResolvedValue({ updated: true, estado: 'pagada' });

    const response = await request(app)
      .patch('/reservas/6/estado')
      .send({ estado: 'Pagada', estado_pago: 'Sin_Abonar' });

    expect(ReservasModel.actualizarEstados).toHaveBeenCalledWith({
      reserva_id: 6,
      estado: 'pagada',
      estado_pago: 'pendiente_pago',
    });
    expect(response.status).toBe(200);
  });

  it('propaga 404 cuando no se actualiza ninguna fila', async () => {
    const app = buildApp();
    ReservasModel.getByIdConClub.mockResolvedValue({
      reserva_id: 5,
      club_id: 10,
      estado: 'pendiente',
      estado_pago: 'pendiente_pago',
    });
    ReservasModel.actualizarEstados.mockResolvedValue({ updated: false, estado: 'pagada' });

    const response = await request(app)
      .patch('/reservas/5/estado')
      .send({ estado: 'pagada' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ mensaje: 'Reserva no encontrada' });
  });
});
