const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth.middleware', () => (req, res, next) => next());
jest.mock('../middleware/roles.middleware', () => ({
  requireRole: () => (req, res, next) => next(),
}));
jest.mock('../middleware/club.middleware', () => (req, res, next) => {
  req.club = { club_id: 10, nombre: 'Club Actual', provincia_id: 2 };
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

const ClubesModel = require('../models/clubes.model');
const ProvinciasModel = require('../models/provincias.model');
const LocalidadesModel = require('../models/localidades.model');
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
    LocalidadesModel.existe.mockReset();
    LocalidadesModel.perteneceAProvincia.mockReset();
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
    LocalidadesModel.existe.mockResolvedValue(true);
    LocalidadesModel.perteneceAProvincia.mockResolvedValue(true);
    ClubesModel.actualizarPorId.mockResolvedValue({
      club_id: 10,
      nombre: 'Club',
      descripcion: 'Desc',
      provincia_id: 1,
      localidad_id: 5,
    });

    const res = await request(app)
      .patch('/mis-datos')
      .send({
        nombre: 'Club',
        descripcion: 'Desc',
        provincia_id: 1,
        localidad_id: 5,
        telefono_contacto: '+54 11 5555-5555',
        email_contacto: 'info@club.com',
        precio_grabacion: 750,
        direccion: 'Av. Siempre Viva 123',
        latitud: -34.6,
        longitud: -58.4,
        google_place_id: 'ChIJ123',
      });

    expect(res.status).toBe(200);
    expect(ClubesModel.actualizarPorId).toHaveBeenCalledWith(10, {
      nombre: 'Club',
      descripcion: 'Desc',
      provincia_id: 1,
      localidad_id: 5,
      telefono_contacto: '+54 11 5555-5555',
      email_contacto: 'info@club.com',
      precio_grabacion: 750,
      direccion: 'Av. Siempre Viva 123',
      latitud: -34.6,
      longitud: -58.4,
      google_place_id: 'ChIJ123',
    });
    expect(res.body).toHaveProperty('mensaje');
    expect(res.body).toHaveProperty('club');
    expect(res.body.club.nombre).toBe('Club');
  });

  it('rechaza teléfono inválido', async () => {
    const app = buildApp();

    const res = await request(app)
      .patch('/mis-datos')
      .send({ nombre: 'Club', telefono_contacto: 'abc123' });

    expect(res.status).toBe(400);
    expect(ClubesModel.actualizarPorId).not.toHaveBeenCalled();
  });

  it('rechaza precio_grabacion negativo', async () => {
    const app = buildApp();

    const res = await request(app)
      .patch('/mis-datos')
      .send({ nombre: 'Club', precio_grabacion: -10 });

    expect(res.status).toBe(400);
    expect(ClubesModel.actualizarPorId).not.toHaveBeenCalled();
  });

  it('requiere provincia cuando se envía localidad', async () => {
    const app = buildApp();
    LocalidadesModel.existe.mockResolvedValue(true);

    const res = await request(app)
      .patch('/mis-datos')
      .send({ nombre: 'Club', provincia_id: null, localidad_id: 9 });

    expect(res.status).toBe(400);
    expect(LocalidadesModel.perteneceAProvincia).not.toHaveBeenCalled();
  });
});
