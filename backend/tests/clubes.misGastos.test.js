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
  obtenerClubPorId: jest.fn(),
  obtenerEconomia: jest.fn(),
}));

jest.mock('../models/gastos.model', () => ({
  listarPorMes: jest.fn(),
  crear: jest.fn(),
  obtenerPorId: jest.fn(),
  actualizar: jest.fn(),
  eliminar: jest.fn(),
}));

const ClubesModel = require('../models/clubes.model');
const GastosModel = require('../models/gastos.model');
const clubesRoutes = require('../routes/clubes.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', clubesRoutes);
  return app;
};

describe('Rutas de gastos y economía', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('obtiene economía del club', async () => {
    const app = buildApp();
    ClubesModel.obtenerClubPorId.mockResolvedValue({ club_id: 1 });
    ClubesModel.obtenerEconomia.mockResolvedValue({ balanceMensual: 100 });

    const res = await request(app).get('/1/economia');

    expect(res.status).toBe(200);
    expect(ClubesModel.obtenerEconomia).toHaveBeenCalledWith('1');
    expect(res.body.data).toEqual({ balanceMensual: 100 });
  });

  it('lista gastos del mes', async () => {
    const app = buildApp();
    const resumen = { porCategoria: [{ categoria: 'Servicios', total: 100 }], total: 100 };
    const gastos = [{ gasto_id: 1, categoria: 'Servicios', monto: 100, fecha: '2024-01-01' }];
    GastosModel.listarPorMes.mockResolvedValue({ gastos, resumen });

    const res = await request(app).get('/mis-gastos');

    expect(res.status).toBe(200);
    expect(GastosModel.listarPorMes).toHaveBeenCalledWith(77, expect.any(Date));
    expect(res.body).toEqual({ club_id: 77, gastos, resumen });
  });

  it('crea un gasto validando campos obligatorios', async () => {
    const app = buildApp();
    const nuevo = {
      gasto_id: 3,
      categoria: 'Luz',
      monto: 50,
      fecha: new Date('2024-02-10').toISOString(),
    };
    GastosModel.crear.mockResolvedValue(nuevo);

    const res = await request(app)
      .post('/mis-gastos')
      .send({ categoria: 'Luz', monto: '50', fecha: '2024-02-10' });

    expect(res.status).toBe(201);
    expect(GastosModel.crear).toHaveBeenCalledWith(77, {
      categoria: 'Luz',
      descripcion: null,
      monto: 50,
      fecha: new Date('2024-02-10'),
    });
    expect(res.body.gasto).toEqual(nuevo);
  });

  it('rechaza creación sin categoría', async () => {
    const app = buildApp();
    const res = await request(app).post('/mis-gastos').send({ monto: 10 });

    expect(res.status).toBe(400);
    expect(GastosModel.crear).not.toHaveBeenCalled();
  });

  it('actualiza un gasto existente', async () => {
    const app = buildApp();
    GastosModel.obtenerPorId.mockResolvedValue({ gasto_id: 9 });
    GastosModel.actualizar.mockResolvedValue({ gasto_id: 9, categoria: 'Mantenimiento', monto: 80 });

    const res = await request(app).put('/mis-gastos/9').send({ categoria: 'Mantenimiento', monto: 80 });

    expect(res.status).toBe(200);
    expect(GastosModel.actualizar).toHaveBeenCalledWith(9, 77, {
      categoria: 'Mantenimiento',
      monto: 80,
    });
    expect(res.body.gasto).toEqual({ gasto_id: 9, categoria: 'Mantenimiento', monto: 80 });
  });

  it('elimina un gasto', async () => {
    const app = buildApp();
    GastosModel.eliminar.mockResolvedValue(true);

    const res = await request(app).delete('/mis-gastos/5');

    expect(res.status).toBe(200);
    expect(GastosModel.eliminar).toHaveBeenCalledWith(5, 77);
    expect(res.body).toEqual({ mensaje: 'Gasto eliminado' });
  });
});
