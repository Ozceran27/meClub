const express = require('express');
const request = require('supertest');

jest.mock('../models/provincias.model', () => ({
  listar: jest.fn(),
  existe: jest.fn(),
}));

jest.mock('../models/localidades.model', () => ({
  listarPorProvincia: jest.fn(),
}));

const ProvinciasModel = require('../models/provincias.model');
const LocalidadesModel = require('../models/localidades.model');
const provinciasRoutes = require('../routes/provincias.routes');

const buildApp = () => {
  const app = express();
  app.use('/', provinciasRoutes);
  return app;
};

describe('GET /:provinciaId/localidades', () => {
  beforeEach(() => {
    ProvinciasModel.existe.mockReset();
    LocalidadesModel.listarPorProvincia.mockReset();
  });

  it('rechaza provinciaId inválido', async () => {
    const app = buildApp();

    const res = await request(app).get('/abc/localidades');

    expect(res.status).toBe(400);
    expect(ProvinciasModel.existe).not.toHaveBeenCalled();
    expect(LocalidadesModel.listarPorProvincia).not.toHaveBeenCalled();
  });

  it('retorna 404 cuando la provincia no existe', async () => {
    const app = buildApp();
    ProvinciasModel.existe.mockResolvedValue(false);

    const res = await request(app).get('/999/localidades');

    expect(res.status).toBe(404);
    expect(ProvinciasModel.existe).toHaveBeenCalledWith(999);
    expect(LocalidadesModel.listarPorProvincia).not.toHaveBeenCalled();
  });

  it('lista localidades filtradas por texto', async () => {
    const app = buildApp();
    ProvinciasModel.existe.mockResolvedValue(true);
    LocalidadesModel.listarPorProvincia.mockResolvedValue([
      { localidad_id: 1, nombre: 'San Martín' },
    ]);

    const res = await request(app).get('/5/localidades?q= san ');

    expect(res.status).toBe(200);
    expect(LocalidadesModel.listarPorProvincia).toHaveBeenCalledWith(5, 'san');
    expect(res.body).toEqual({
      provincia_id: 5,
      localidades: [{ localidad_id: 1, nombre: 'San Martín' }],
    });
  });
});
