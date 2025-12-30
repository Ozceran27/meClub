const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth.middleware', () => (req, res, next) => next());
jest.mock('../middleware/roles.middleware', () => ({
  requireRole: () => (req, res, next) => next(),
}));
jest.mock('../middleware/club.middleware', () => (req, res, next) => {
  req.club = { club_id: 77 };
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

jest.mock('../models/clubServicios.model', () => ({
  listarPorClub: jest.fn(),
  reemplazarSeleccion: jest.fn(),
}));

jest.mock('../models/clubesImpuestos.model', () => ({
  listarSeleccionados: jest.fn(),
  reemplazarSeleccion: jest.fn(),
}));

const ClubesImpuestosModel = require('../models/clubesImpuestos.model');
const clubesRoutes = require('../routes/clubes.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', clubesRoutes);
  return app;
};

describe('Rutas /mis-impuestos', () => {
  beforeEach(() => {
    ClubesImpuestosModel.listarSeleccionados.mockReset();
    ClubesImpuestosModel.reemplazarSeleccion.mockReset();
  });

  it('lista impuestos activos', async () => {
    const app = buildApp();
    ClubesImpuestosModel.listarSeleccionados.mockResolvedValue([
      { impuesto_id: 1, nombre: 'IVA', porcentaje: 21 },
    ]);

    const res = await request(app).get('/mis-impuestos');

    expect(res.status).toBe(200);
    expect(res.body.impuestos).toEqual([{ impuesto_id: 1, nombre: 'IVA', porcentaje: 21 }]);
  });

  it('rechaza peticiones PATCH sin items', async () => {
    const app = buildApp();

    const res = await request(app).patch('/mis-impuestos').send({});

    expect(res.status).toBe(400);
    expect(ClubesImpuestosModel.reemplazarSeleccion).not.toHaveBeenCalled();
  });

  it('rechaza nombres duplicados', async () => {
    const app = buildApp();

    const res = await request(app)
      .patch('/mis-impuestos')
      .send({ items: [{ nombre: 'IVA', porcentaje: 10 }, { nombre: 'iva', porcentaje: 5 }] });

    expect(res.status).toBe(400);
    expect(ClubesImpuestosModel.reemplazarSeleccion).not.toHaveBeenCalled();
  });

  it('valida porcentaje numérico y rango', async () => {
    const app = buildApp();

    const res = await request(app)
      .patch('/mis-impuestos')
      .send({ items: [{ nombre: 'IVA', porcentaje: 150 }] });

    expect(res.status).toBe(400);
    expect(ClubesImpuestosModel.reemplazarSeleccion).not.toHaveBeenCalled();
  });

  it('rechaza descripciones no textuales', async () => {
    const app = buildApp();

    const res = await request(app)
      .patch('/mis-impuestos')
      .send({ items: [{ nombre: 'IVA', porcentaje: 21, descripcion: 123 }] });

    expect(res.status).toBe(400);
    expect(ClubesImpuestosModel.reemplazarSeleccion).not.toHaveBeenCalled();
  });

  it('actualiza impuestos correctamente', async () => {
    const app = buildApp();
    ClubesImpuestosModel.reemplazarSeleccion.mockResolvedValue([
      { impuesto_id: 2, nombre: 'IVA', porcentaje: 21 },
    ]);

    const res = await request(app)
      .patch('/mis-impuestos')
      .send({ items: [{ nombre: 'IVA', porcentaje: '21.5', descripcion: 'Impuesto' }] });

    expect(res.status).toBe(200);
    expect(ClubesImpuestosModel.reemplazarSeleccion).toHaveBeenCalledWith(77, [
      { nombre: 'IVA', porcentaje: 21.5, descripcion: 'Impuesto' },
    ]);
    expect(res.body.impuestos).toEqual([{ impuesto_id: 2, nombre: 'IVA', porcentaje: 21 }]);
  });
});
