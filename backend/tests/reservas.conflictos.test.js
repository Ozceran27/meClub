const express = require('express');
const request = require('supertest');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../middleware/auth.middleware', () => (req, _res, next) => {
  req.usuario = { id: 99, rol: 'usuario' };
  next();
});

jest.mock('../models/canchas.model', () => ({
  obtenerCanchaPorId: jest.fn(),
}));

jest.mock('../models/tarifas.model', () => ({
  obtenerTarifaAplicable: jest.fn(),
}));

jest.mock('../models/clubesHorario.model', () => ({
  getPorClubYDia: jest.fn(),
}));

const db = require('../config/db');
const ReservasModel = require('../models/reservas.model');
const CanchasModel = require('../models/canchas.model');
const TarifasModel = require('../models/tarifas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const reservasRoutes = require('../routes/reservas.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/reservas', reservasRoutes);
  return app;
};

describe('Gestión de solapes de reservas', () => {
  let reservasEnMemoria;
  let connectionMock;

  beforeEach(() => {
    jest.clearAllMocks();

    reservasEnMemoria = [
      {
        reserva_id: 1,
        usuario_id: 42,
        cancha_id: 5,
        fecha: '2099-01-01',
        hora_inicio: '10:00:00',
        hora_fin: '11:00:00',
        estado: 'pendiente',
        duracion_horas: 1,
        monto: 2000,
        grabacion_solicitada: 0,
      },
    ];

    connectionMock = {
      beginTransaction: jest.fn().mockResolvedValue(),
      query: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn().mockResolvedValue(),
    };

    CanchasModel.obtenerCanchaPorId.mockResolvedValue({
      cancha_id: 5,
      club_id: 3,
      nombre: 'Central',
      precio: 2000,
    });
    TarifasModel.obtenerTarifaAplicable.mockResolvedValue(null);
    ClubesHorarioModel.getPorClubYDia.mockResolvedValue({
      activo: true,
      abre: '08:00:00',
      cierra: '23:00:00',
    });

    db.query.mockImplementation((sql, params = []) => {
      if (sql.startsWith('SELECT r.reserva_id') && sql.includes('FROM reservas r')) {
        const [canchaId, fecha, horaInicio, horaFin, estadosActivos] = params;
        const activos = Array.isArray(estadosActivos) ? estadosActivos : [];
        const overlapping = reservasEnMemoria.filter((reserva) =>
          reserva.cancha_id === canchaId &&
          reserva.fecha === fecha &&
          !(reserva.hora_fin <= horaInicio || reserva.hora_inicio >= horaFin) &&
          activos.includes(reserva.estado)
        );
        return Promise.resolve([overlapping.slice(0, 1), []]);
      }

      if (sql.startsWith('INSERT INTO reservas')) {
        const [usuarioId, canchaId, fecha, horaInicio, horaFin, monto, grabacionSolicitada, duracionHoras] = params;
        const nuevaReserva = {
          reserva_id: reservasEnMemoria.length + 1,
          usuario_id: usuarioId,
          cancha_id: canchaId,
          fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          estado: 'pendiente',
          duracion_horas: duracionHoras,
          monto,
          grabacion_solicitada: grabacionSolicitada,
        };
        reservasEnMemoria.push(nuevaReserva);
        return Promise.resolve([{ insertId: nuevaReserva.reserva_id }, []]);
      }

      if (sql.startsWith('UPDATE reservas SET estado')) {
        const [nuevoEstado, reservaId] = params;
        const reserva = reservasEnMemoria.find((item) => item.reserva_id === reservaId);
        if (reserva) {
          reserva.estado = nuevoEstado;
          return Promise.resolve([{ affectedRows: 1 }, []]);
        }
        return Promise.resolve([{ affectedRows: 0 }, []]);
      }

      return Promise.reject(new Error(`Query no mockeada: ${sql}`));
    });

    connectionMock.query.mockImplementation((sql, params = []) => {
      if (sql.startsWith('SELECT r.reserva_id') && sql.includes('FOR UPDATE')) {
        const [canchaId, fecha, horaInicio, horaFin, estadosActivos] = params;
        const activos = Array.isArray(estadosActivos) ? estadosActivos : [];
        const overlapping = reservasEnMemoria.filter((reserva) =>
          reserva.cancha_id === canchaId &&
          reserva.fecha === fecha &&
          !(reserva.hora_fin <= horaInicio || reserva.hora_inicio >= horaFin) &&
          activos.includes(reserva.estado)
        );
        return Promise.resolve([overlapping.slice(0, 1), []]);
      }

      if (sql.startsWith('INSERT INTO reservas')) {
        const [usuarioId, canchaId, fecha, horaInicio, horaFin, monto, grabacionSolicitada, duracionHoras] = params;
        const nuevaReserva = {
          reserva_id: reservasEnMemoria.length + 1,
          usuario_id: usuarioId,
          cancha_id: canchaId,
          fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          estado: 'pendiente',
          duracion_horas: duracionHoras,
          monto,
          grabacion_solicitada: grabacionSolicitada,
        };
        reservasEnMemoria.push(nuevaReserva);
        return Promise.resolve([{ insertId: nuevaReserva.reserva_id }, []]);
      }

      return Promise.reject(new Error(`Query no mockeada en conexión: ${sql}`));
    });

    db.getConnection.mockResolvedValue(connectionMock);
  });

  it('libera el horario cuando una reserva activa pasa a cancelada', async () => {
    const app = buildApp();

    const payload = {
      cancha_id: 5,
      fecha: '2099-01-01',
      hora_inicio: '10:00:00',
      duracion_horas: 1,
      grabacion_solicitada: false,
    };

    const primerIntento = await request(app).post('/reservas').send(payload);
    expect(primerIntento.status).toBe(409);
    expect(primerIntento.body.mensaje).toMatch(/se solapa/i);

    const sigueActivo = await ReservasModel.updateEstado(1, 'cancelada');
    expect(sigueActivo).toBe(false);

    const segundoIntento = await request(app).post('/reservas').send(payload);
    expect(segundoIntento.status).toBe(201);
    expect(segundoIntento.body.reserva).toMatchObject({
      cancha_id: 5,
      fecha: '2099-01-01',
      hora_inicio: '10:00:00',
    });
  });
});
