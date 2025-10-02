const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth.middleware', () => (req, res, next) => next());
jest.mock('../middleware/roles.middleware', () => ({
  requireRole: () => (req, res, next) => next(),
}));
jest.mock('../middleware/club.middleware', () => (req, res, next) => {
  req.club = { club_id: 42 };
  next();
});

jest.mock('../models/clubes.model', () => ({
  actualizarPorId: jest.fn(),
}));

jest.mock('../models/provincias.model', () => ({
  existe: jest.fn(),
}));

jest.mock('../models/localidades.model', () => ({
  existe: jest.fn(),
  perteneceAProvincia: jest.fn(),
}));

jest.mock('../models/servicios.model', () => ({
  listarDisponibles: jest.fn(),
}));

jest.mock('../models/clubesServicios.model', () => ({
  listarSeleccionados: jest.fn(),
  reemplazarSeleccion: jest.fn(),
}));

jest.mock('../models/clubesImpuestos.model', () => ({
  listarSeleccionados: jest.fn(),
  reemplazarSeleccion: jest.fn(),
}));

const ServiciosModel = require('../models/servicios.model');
const ClubesServiciosModel = require('../models/clubesServicios.model');
const clubesRoutes = require('../routes/clubes.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', clubesRoutes);
  return app;
};

describe('Rutas /mis-servicios', () => {
  beforeEach(() => {
    ServiciosModel.listarDisponibles.mockReset();
    ClubesServiciosModel.listarSeleccionados.mockReset();
    ClubesServiciosModel.reemplazarSeleccion.mockReset();
  });

  it('lista servicios con el flag seleccionado', async () => {
    const app = buildApp();
    ServiciosModel.listarDisponibles.mockResolvedValue([
      { servicio_id: 1, nombre: 'Bar' },
      { servicio_id: 2, nombre: 'Pileta' },
    ]);
    ClubesServiciosModel.listarSeleccionados.mockResolvedValue([{ servicio_id: 2 }]);

    const res = await request(app).get('/mis-servicios');

    expect(res.status).toBe(200);
    expect(res.body.servicios).toEqual([
      { servicio_id: 1, nombre: 'Bar', seleccionado: false },
      { servicio_id: 2, nombre: 'Pileta', seleccionado: true },
    ]);
  });

  it('rechaza peticiones PATCH sin arreglo', async () => {
    const app = buildApp();

    const res = await request(app).patch('/mis-servicios').send({});

    expect(res.status).toBe(400);
    expect(ClubesServiciosModel.reemplazarSeleccion).not.toHaveBeenCalled();
  });

  it('rechaza ids no numéricos', async () => {
    const app = buildApp();

    const res = await request(app).patch('/mis-servicios').send({ servicio_ids: ['abc'] });

    expect(res.status).toBe(400);
    expect(ClubesServiciosModel.reemplazarSeleccion).not.toHaveBeenCalled();
  });

  it('rechaza ids duplicados', async () => {
    const app = buildApp();

    const res = await request(app).patch('/mis-servicios').send({ servicio_ids: [1, 1] });

    expect(res.status).toBe(400);
    expect(ClubesServiciosModel.reemplazarSeleccion).not.toHaveBeenCalled();
  });

  it('valida que los servicios existan', async () => {
    const app = buildApp();
    ServiciosModel.listarDisponibles.mockResolvedValue([{ servicio_id: 1 }]);

    const res = await request(app).patch('/mis-servicios').send({ servicio_ids: [2] });

    expect(res.status).toBe(400);
    expect(ClubesServiciosModel.reemplazarSeleccion).not.toHaveBeenCalled();
  });

  it('actualiza servicios correctamente', async () => {
    const app = buildApp();
    ServiciosModel.listarDisponibles.mockResolvedValue([{ servicio_id: 1 }, { servicio_id: 2 }]);
    ClubesServiciosModel.reemplazarSeleccion.mockResolvedValue([{ servicio_id: 1 }]);

    const res = await request(app).patch('/mis-servicios').send({ servicio_ids: ['1'] });

    expect(res.status).toBe(200);
    expect(ClubesServiciosModel.reemplazarSeleccion).toHaveBeenCalledWith(42, [1]);
    expect(res.body.servicios).toEqual([{ servicio_id: 1 }]);
  });
});
