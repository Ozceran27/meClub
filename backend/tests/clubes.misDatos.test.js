const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth.middleware', () => (req, res, next) => next());
jest.mock('../middleware/roles.middleware', () => ({
  requireRole: () => (req, res, next) => next(),
}));
jest.mock('../middleware/club.middleware', () => (req, res, next) => {
  req.club = { club_id: 10, nombre: 'Club Actual' };
  next();
});

jest.mock('../models/clubes.model', () => ({
  actualizarPorId: jest.fn(),
}));

jest.mock('../models/provincias.model', () => ({
  existe: jest.fn(),
}));

const ClubesModel = require('../models/clubes.model');
const ProvinciasModel = require('../models/provincias.model');
const clubesRoutes = require('../routes/clubes.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', clubesRoutes);
  return app;
};

describe('PATCH /mis-datos', () => {
  beforeEach(() => {
    ClubesModel.actualizarPorId.mockReset();
    ProvinciasModel.existe.mockReset();
  });

  it('rechaza solicitudes sin nombre', async () => {
    const app = buildApp();

    const res = await request(app).patch('/mis-datos').send({ descripcion: 'Desc' });

    expect(res.status).toBe(400);
    expect(ClubesModel.actualizarPorId).not.toHaveBeenCalled();
  });

  it('rechaza provincia inexistente', async () => {
    const app = buildApp();
    ProvinciasModel.existe.mockResolvedValue(false);

    const res = await request(app)
      .patch('/mis-datos')
      .send({ nombre: 'Club', provincia_id: 999 });

    expect(res.status).toBe(400);
    expect(ProvinciasModel.existe).toHaveBeenCalledWith(999);
    expect(ClubesModel.actualizarPorId).not.toHaveBeenCalled();
  });

  it('actualiza datos válidos', async () => {
    const app = buildApp();
    ProvinciasModel.existe.mockResolvedValue(true);
    ClubesModel.actualizarPorId.mockResolvedValue({
      club_id: 10,
      nombre: 'Club',
      descripcion: 'Desc',
      provincia_id: 1,
    });

    const res = await request(app)
      .patch('/mis-datos')
      .send({ nombre: 'Club', descripcion: 'Desc', provincia_id: 1 });

    expect(res.status).toBe(200);
    expect(ClubesModel.actualizarPorId).toHaveBeenCalledWith(10, {
      nombre: 'Club',
      descripcion: 'Desc',
      provincia_id: 1,
    });
    expect(res.body).toHaveProperty('mensaje');
    expect(res.body).toHaveProperty('club');
    expect(res.body.club.nombre).toBe('Club');
  });
});
