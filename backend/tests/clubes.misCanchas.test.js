const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth.middleware', () => (req, _res, next) => next());
jest.mock('../middleware/roles.middleware', () => ({
  requireRole: () => (req, _res, next) => next(),
}));
jest.mock('../middleware/club.middleware', () => (req, _res, next) => {
  req.club = { club_id: 10, nombre: 'Club Prueba' };
  next();
});

global.__testCanchaFile = null;
jest.mock('../middleware/logoUpload.middleware', () => ({
  buildSingleUploadMiddleware: jest.fn(() => (req, _res, next) => {
    if (global.__testCanchaFile) {
      req.file = global.__testCanchaFile;
    }
    next();
  }),
}));

jest.mock('../models/clubes.model', () => ({
  obtenerMisCanchas: jest.fn(),
}));

jest.mock('../models/canchas.model', () => ({
  crearCancha: jest.fn(),
  obtenerCanchaPorId: jest.fn(),
  actualizarCancha: jest.fn(),
  eliminarCancha: jest.fn(),
  actualizarImagen: jest.fn(),
  obtenerResumen: jest.fn(),
}));

const ClubesModel = require('../models/clubes.model');
const CanchasModel = require('../models/canchas.model');
const { buildSingleUploadMiddleware } = require('../middleware/logoUpload.middleware');
const clubesRoutes = require('../routes/clubes.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', clubesRoutes);
  return app;
};

describe('Rutas de Mis Canchas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.__testCanchaFile = null;
  });

  it('lista canchas con campos extendidos', async () => {
    const app = buildApp();
    ClubesModel.obtenerMisCanchas.mockResolvedValue([
      {
        cancha_id: 1,
        club_id: 10,
        nombre: 'Central',
        deporte_id: 2,
        deporte_nombre: 'Fútbol 5',
        capacidad: 10,
        precio: 1500,
        precio_dia: 1500,
        precio_noche: 1700,
        tipo_suelo: 'Césped',
        techada: true,
        iluminacion: true,
        estado: 'disponible',
        imagen_url: '/uploads/canchas/central.png',
      },
    ]);

    const res = await request(app).get('/mis-canchas');

    expect(res.status).toBe(200);
    expect(res.body.canchas).toHaveLength(1);
    expect(res.body.canchas[0]).toHaveProperty('deporte_nombre', 'Fútbol 5');
    expect(ClubesModel.obtenerMisCanchas).toHaveBeenCalledWith(10);
  });

  it('rechaza creación sin campos obligatorios', async () => {
    const app = buildApp();

    const res = await request(app).post('/mis-canchas').send({ nombre: '' });

    expect(res.status).toBe(400);
    expect(CanchasModel.crearCancha).not.toHaveBeenCalled();
  });

  it('crea cancha con normalización de datos', async () => {
    const app = buildApp();

    CanchasModel.crearCancha.mockResolvedValue({ cancha_id: 55 });

    const res = await request(app)
      .post('/mis-canchas')
      .send({
        nombre: '  Cancha Central  ',
        deporte_id: '5',
        capacidad: '12',
        precio: '1000.555',
        precio_dia: '1200.4',
        precio_noche: '',
        tipo_suelo: '  Cemento ',
        techada: 'true',
        iluminacion: '0',
        estado: 'mantenimiento',
      });

    expect(res.status).toBe(201);
    expect(CanchasModel.crearCancha).toHaveBeenCalledWith({
      club_id: 10,
      nombre: 'Cancha Central',
      deporte_id: 5,
      capacidad: 12,
      precio: 1000.56,
      precio_dia: 1200.4,
      precio_noche: null,
      tipo_suelo: 'Cemento',
      techada: true,
      iluminacion: false,
      estado: 'mantenimiento',
    });
  });

  it('impide actualizar con estado inválido', async () => {
    const app = buildApp();
    CanchasModel.obtenerCanchaPorId.mockResolvedValue({ cancha_id: 1, club_id: 10 });

    const res = await request(app).patch('/mis-canchas/1').send({ estado: 'cerrada' });

    expect(res.status).toBe(400);
    expect(CanchasModel.actualizarCancha).not.toHaveBeenCalled();
  });

  it('actualiza cancha válida', async () => {
    const app = buildApp();
    CanchasModel.obtenerCanchaPorId.mockResolvedValue({ cancha_id: 1, club_id: 10 });
    CanchasModel.actualizarCancha.mockResolvedValue({ cancha_id: 1, precio: 2000 });

    const res = await request(app)
      .patch('/mis-canchas/1')
      .send({ precio: '2000', iluminacion: 1 });

    expect(res.status).toBe(200);
    expect(CanchasModel.actualizarCancha).toHaveBeenCalledWith(1, {
      precio: 2000,
      iluminacion: true,
    });
  });

  it('elimina cancha existente', async () => {
    const app = buildApp();
    CanchasModel.obtenerCanchaPorId.mockResolvedValue({ cancha_id: 7, club_id: 10 });

    const res = await request(app).delete('/mis-canchas/7');

    expect(res.status).toBe(200);
    expect(CanchasModel.eliminarCancha).toHaveBeenCalledWith(7);
  });

  it('rechaza subir imagen sin archivo', async () => {
    const app = buildApp();
    CanchasModel.obtenerCanchaPorId.mockResolvedValue({ cancha_id: 9, club_id: 10 });

    const res = await request(app).post('/mis-canchas/9/imagen');

    expect(res.status).toBe(400);
    expect(CanchasModel.actualizarImagen).not.toHaveBeenCalled();
  });

  it('sube imagen y devuelve nueva ruta', async () => {
    const app = buildApp();
    CanchasModel.obtenerCanchaPorId
      .mockResolvedValueOnce({ cancha_id: 11, club_id: 10, imagen_url: null })
      .mockResolvedValueOnce({ cancha_id: 11, club_id: 10, imagen_url: '/uploads/canchas/nueva.png' });

    CanchasModel.actualizarImagen.mockResolvedValue('/uploads/canchas/nueva.png');

    global.__testCanchaFile = {
      buffer: Buffer.from('file'),
      mimetype: 'image/png',
      originalname: 'foto.png',
    };

    const res = await request(app).post('/mis-canchas/11/imagen');

    expect(res.status).toBe(200);
    expect(CanchasModel.actualizarImagen).toHaveBeenCalledWith(11, global.__testCanchaFile);
    expect(res.body).toHaveProperty('imagen_url', '/uploads/canchas/nueva.png');
  });

  it('devuelve resumen de cancha', async () => {
    const app = buildApp();
    CanchasModel.obtenerCanchaPorId.mockResolvedValue({ cancha_id: 3, club_id: 10 });
    CanchasModel.obtenerResumen.mockResolvedValue({ disponibleAhora: true });

    const res = await request(app).get('/mis-canchas/3/resumen');

    expect(res.status).toBe(200);
    expect(CanchasModel.obtenerResumen).toHaveBeenCalledWith(3);
    expect(res.body).toHaveProperty('resumen');
  });
});
