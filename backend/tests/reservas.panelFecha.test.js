const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth.middleware', () => (req, _res, next) => {
  req.usuario = { rol: 'club', sub: 101 };
  next();
});

jest.mock('../middleware/roles.middleware', () => ({
  requireRole: () => (req, _res, next) => next(),
}));

jest.mock('../middleware/club.middleware', () => (req, _res, next) => {
  req.club = { club_id: 77, precio_grabacion: 500 };
  next();
});

jest.mock('../models/reservas.model', () => ({
  resumenReservasClub: jest.fn(),
  reservasAgendaClub: jest.fn(),
  reservasEnCurso: jest.fn(),
}));

jest.mock('../models/canchas.model', () => ({
  listarPorClub: jest.fn(),
}));

const ReservasModel = require('../models/reservas.model');
const CanchasModel = require('../models/canchas.model');
const reservasRoutes = require('../routes/reservas.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/reservas', reservasRoutes);
  return app;
};

describe('GET /reservas/panel con parámetro de fecha', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ReservasModel.resumenReservasClub.mockResolvedValue([]);
    ReservasModel.reservasAgendaClub.mockResolvedValue([]);
    ReservasModel.reservasEnCurso.mockResolvedValue([]);
    CanchasModel.listarPorClub.mockResolvedValue([]);
  });

  it('utiliza la fecha solicitada y ajusta el rango semanal', async () => {
    const app = buildApp();

    const response = await request(app).get('/reservas/panel?fecha=2025-11-02');

    expect(response.status).toBe(200);
    expect(response.body.fecha).toBe('2025-11-02');

    expect(ReservasModel.resumenReservasClub).toHaveBeenCalledWith({
      club_id: 77,
      fecha: '2025-11-02',
    });

    const fechasSolicitadas = ReservasModel.resumenReservasClub.mock.calls.map((args) => args[0].fecha);
    expect(fechasSolicitadas).toContain('2025-10-27');
    expect(fechasSolicitadas.filter((fecha) => fecha === '2025-11-02').length).toBeGreaterThanOrEqual(1);

    expect(ReservasModel.reservasAgendaClub).toHaveBeenCalledWith({
      club_id: 77,
      fecha: '2025-11-02',
    });

    expect(ReservasModel.reservasEnCurso).toHaveBeenCalledWith(
      expect.objectContaining({ club_id: 77, fecha: '2025-11-02', ahora: expect.any(String) })
    );

    expect(CanchasModel.listarPorClub).toHaveBeenCalledWith(77);
  });

  it('incluye las canchas disponibles aunque no tengan reservas', async () => {
    const app = buildApp();

    CanchasModel.listarPorClub.mockResolvedValue([
      { cancha_id: 1, nombre: 'Cancha Principal', estado: 'disponible' },
      { cancha_id: 2, nombre: 'Cancha Secundaria', estado: 'mantenimiento' },
    ]);

    ReservasModel.reservasAgendaClub.mockResolvedValue([]);

    const response = await request(app).get('/reservas/panel');

    expect(response.status).toBe(200);
    expect(response.body.agenda).toEqual([
      {
        cancha_id: 1,
        cancha_nombre: 'Cancha Principal',
        reservas: [],
      },
    ]);
  });
});
