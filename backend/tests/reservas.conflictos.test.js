const express = require('express');
const request = require('supertest');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../middleware/auth.middleware', () => (req, _res, next) => {
  req.usuario = global.__TEST_AUTH_USER__ || { id: 99, rol: 'usuario' };
  next();
});

jest.mock('../middleware/club.middleware', () => (req, _res, next) => {
  if (global.__TEST_CLUB__) {
    req.club = global.__TEST_CLUB__;
  }
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

jest.mock('../models/clubes.model', () => ({
  obtenerClubPorId: jest.fn(),
  obtenerClubPorPropietario: jest.fn(),
}));

jest.mock('../models/usuarios.model', () => ({
  buscarPorId: jest.fn(),
}));

const db = require('../config/db');
const ReservasModel = require('../models/reservas.model');
const CanchasModel = require('../models/canchas.model');
const TarifasModel = require('../models/tarifas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const ClubesModel = require('../models/clubes.model');
const UsuariosModel = require('../models/usuarios.model');
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
        creado_por_id: 7,
        club_id: 3,
        cancha_id: 5,
        fecha: '2099-01-01',
        hora_inicio: '10:00:00',
        hora_fin: '11:00:00',
        estado: 'pendiente',
        estado_pago: 'sin_abonar',
        duracion_horas: 1,
        monto: 2000,
        monto_base: 2000,
        monto_grabacion: 0,
        grabacion_solicitada: 0,
        tipo_reserva: 'relacionada',
        contacto_nombre: 'Juan',
        contacto_apellido: 'Pérez',
        contacto_telefono: '123456',
      },
    ];

    global.__TEST_AUTH_USER__ = { id: 99, rol: 'usuario' };
    global.__TEST_CLUB__ = {
      club_id: 3,
      precio_grabacion: null,
      rango_nocturno_inicio: '22:00:00',
      rango_nocturno_fin: '06:00:00',
    };

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
      precio_dia: 2000,
      precio_noche: 2500,
    });
    TarifasModel.obtenerTarifaAplicable.mockResolvedValue(null);
    ClubesHorarioModel.getPorClubYDia.mockResolvedValue({
      activo: true,
      abre: '00:00:00',
      cierra: '23:59:59',
    });
    ClubesModel.obtenerClubPorId.mockResolvedValue({
      club_id: 3,
      precio_grabacion: null,
      rango_nocturno_inicio: '22:00:00',
      rango_nocturno_fin: '06:00:00',
    });
    ClubesModel.obtenerClubPorPropietario.mockResolvedValue({ club_id: 3 });
    UsuariosModel.buscarPorId.mockReset();
    UsuariosModel.buscarPorId.mockResolvedValue(null);

    const buildInsertReserva = (params) => {
      const [
        usuarioId,
        clubId,
        canchaId,
        fecha,
        horaInicio,
        horaFin,
        monto,
        grabacionSolicitada,
        duracionHoras,
        tipoReserva,
        contactoNombre,
        contactoApellido,
        contactoTelefono,
        creadoPorId,
        estadoPago,
        montoBase,
        montoGrabacion,
      ] = params;

      const nuevaReserva = {
        reserva_id: reservasEnMemoria.length + 1,
        usuario_id: usuarioId,
        creado_por_id: creadoPorId,
        club_id: clubId,
        cancha_id: canchaId,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        estado: 'pendiente',
        estado_pago: estadoPago ?? 'sin_abonar',
        duracion_horas: duracionHoras,
        monto,
        monto_base: montoBase,
        monto_grabacion: montoGrabacion,
        grabacion_solicitada: Boolean(grabacionSolicitada),
        tipo_reserva: tipoReserva,
        contacto_nombre: contactoNombre,
        contacto_apellido: contactoApellido,
        contacto_telefono: contactoTelefono,
      };
      reservasEnMemoria.push(nuevaReserva);
      return nuevaReserva;
    };

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
        const nuevaReserva = buildInsertReserva(params);
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
        const nuevaReserva = buildInsertReserva(params);
        return Promise.resolve([{ insertId: nuevaReserva.reserva_id }, []]);
      }

      return Promise.reject(new Error(`Query no mockeada en conexión: ${sql}`));
    });

    db.getConnection.mockResolvedValue(connectionMock);
  });

  afterEach(() => {
    delete global.__TEST_AUTH_USER__;
    delete global.__TEST_CLUB__;
  });

  it('rechaza reservas que superan el horario de cierre', async () => {
    const app = buildApp();

    ClubesHorarioModel.getPorClubYDia.mockResolvedValueOnce({
      activo: true,
      abre: '08:00:00',
      cierra: '23:00:00',
    });

    const payload = {
      cancha_id: 5,
      fecha: '2099-05-10',
      hora_inicio: '22:00:00',
      duracion_horas: 2,
      tipo_reserva: 'privada',
      contacto_nombre: 'Mario',
      contacto_apellido: 'Rossi',
      contacto_telefono: '1234-5678',
    };

    const respuesta = await request(app).post('/reservas').send(payload);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.mensaje).toMatch(/fuera del horario comercial/i);

    const intentoInsercion = db.query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.startsWith('INSERT INTO reservas')
    );
    expect(intentoInsercion).toBeUndefined();
  });

  it('libera el horario cuando una reserva activa pasa a cancelada', async () => {
    const app = buildApp();

    const payload = {
      cancha_id: 5,
      fecha: '2099-01-01',
      hora_inicio: '10:00:00',
      duracion_horas: 1,
      grabacion_solicitada: false,
      tipo_reserva: 'privada',
      contacto_nombre: 'Luisa',
      contacto_apellido: 'Martínez',
      contacto_telefono: '1111-2222',
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

  it('permite a un club crear una reserva privada incluyendo el recargo de cámara cuando corresponde', async () => {
    const app = buildApp();

    global.__TEST_AUTH_USER__ = { id: 777, rol: 'club' };
    global.__TEST_CLUB__ = {
      club_id: 3,
      precio_grabacion: 500,
      rango_nocturno_inicio: '22:00:00',
      rango_nocturno_fin: '06:00:00',
    };

    const payload = {
      cancha_id: 5,
      fecha: '2099-01-01',
      hora_inicio: '12:00:00',
      duracion_horas: 1,
      tipo_reserva: 'privada',
      grabacion_solicitada: true,
      contacto_nombre: 'Carla',
      contacto_apellido: 'Gómez',
      contacto_telefono: '555-0000',
    };

    const respuesta = await request(app).post('/reservas').send(payload);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.reserva).toMatchObject({
      tipo_reserva: 'privada',
      creado_por_id: 777,
      usuario_id: null,
      monto_base: 2000,
      monto_grabacion: 500,
      monto: 2500,
      grabacion_solicitada: true,
      contacto_nombre: 'Carla',
      contacto_apellido: 'Gómez',
      contacto_telefono: '555-0000',
    });
  });

  it('permite a un club crear una reserva relacionada sin recargo de cámara cuando no se solicita', async () => {
    const app = buildApp();

    global.__TEST_AUTH_USER__ = { id: 888, rol: 'club' };
    global.__TEST_CLUB__ = {
      club_id: 3,
      precio_grabacion: 600,
      rango_nocturno_inicio: '22:00:00',
      rango_nocturno_fin: '06:00:00',
    };

    UsuariosModel.buscarPorId.mockResolvedValue({
      usuario_id: 555,
      nombre: 'Ada',
      apellido: 'Lovelace',
      telefono: '123456789',
    });

    const payload = {
      cancha_id: 5,
      fecha: '2099-01-01',
      hora_inicio: '14:00:00',
      duracion_horas: 1,
      tipo_reserva: 'relacionada',
      jugador_usuario_id: 555,
      grabacion_solicitada: false,
    };

    const respuesta = await request(app).post('/reservas').send(payload);

    expect(UsuariosModel.buscarPorId).toHaveBeenCalledWith(555);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.reserva).toMatchObject({
      tipo_reserva: 'relacionada',
      creado_por_id: 888,
      usuario_id: 555,
      monto_base: 2000,
      monto_grabacion: 0,
      monto: 2000,
      grabacion_solicitada: false,
      contacto_nombre: 'Ada',
      contacto_apellido: 'Lovelace',
      contacto_telefono: '123456789',
    });
  });

  describe('cálculo de monto base según horario nocturno', () => {
    it('usa el precio diurno cuando el inicio cae fuera del rango nocturno y no hay tarifa', async () => {
      const app = buildApp();

      const payload = {
        cancha_id: 5,
        fecha: '2099-02-01',
        hora_inicio: '10:00:00',
        duracion_horas: 1,
        tipo_reserva: 'privada',
        contacto_nombre: 'Laura',
        contacto_apellido: 'Suarez',
        contacto_telefono: '111-222',
      };

      const respuesta = await request(app).post('/reservas').send(payload);

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.reserva).toMatchObject({ monto_base: 2000, monto: 2000 });
    });

    it('usa el precio nocturno cuando el inicio cae dentro del rango nocturno sin tarifa personalizada', async () => {
      const app = buildApp();

      const payload = {
        cancha_id: 5,
        fecha: '2099-02-02',
        hora_inicio: '22:30:00',
        duracion_horas: 1,
        tipo_reserva: 'privada',
        contacto_nombre: 'Laura',
        contacto_apellido: 'Suarez',
        contacto_telefono: '111-222',
      };

      const respuesta = await request(app).post('/reservas').send(payload);

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.reserva).toMatchObject({ monto_base: 2500, monto: 2500 });
    });

    it('prioriza la tarifa personalizada por sobre los precios de la cancha', async () => {
      const app = buildApp();

      TarifasModel.obtenerTarifaAplicable.mockResolvedValueOnce({ tarifa_id: 99, precio: 1800 });

      const payload = {
        cancha_id: 5,
        fecha: '2099-02-03',
        hora_inicio: '22:30:00',
        duracion_horas: 1,
        tipo_reserva: 'privada',
        contacto_nombre: 'Laura',
        contacto_apellido: 'Suarez',
        contacto_telefono: '111-222',
      };

      const respuesta = await request(app).post('/reservas').send(payload);

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.reserva).toMatchObject({ monto_base: 1800, monto: 1800 });
    });
  });

  it('consulta reservasAgendaClub filtrando por club y ordenando por hora', async () => {
    const clubId = 42;
    const fecha = '2099-01-02';
    const filasOrdenadas = [
      { reserva_id: 1, cancha_id: 7, hora_inicio: '08:00:00', cancha_nombre: 'A' },
      { reserva_id: 2, cancha_id: 7, hora_inicio: '09:00:00', cancha_nombre: 'A' },
    ];

    db.query.mockImplementationOnce((sql, params = []) => {
      expect(sql).toMatch(/FROM reservas r/);
      expect(sql).toMatch(/WHERE c\.club_id = \?/);
      expect(sql).toMatch(/ORDER BY r\.hora_inicio ASC, c\.cancha_id ASC/);
      expect(params).toEqual([clubId, fecha]);
      return Promise.resolve([filasOrdenadas, []]);
    });

    const resultado = await ReservasModel.reservasAgendaClub({ club_id: clubId, fecha });
    expect(resultado).toEqual(filasOrdenadas);
  });
});
