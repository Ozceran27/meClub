const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const db = require('../config/db');
const ReservasModel = require('./reservas.model');

const imagenesDir = path.join(__dirname, '..', 'uploads', 'canchas');
const imagenesPublicPath = '/uploads/canchas';

fs.mkdirSync(imagenesDir, { recursive: true });

const ESTADOS_VALIDOS = new Set(['disponible', 'mantenimiento', 'inactiva']);

const mapCanchaRow = (row) => {
  if (!row) return null;

  const normalizeDecimal = (value) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const normalizeInteger = (value) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const normalizeString = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (Buffer.isBuffer(value)) {
      const candidate = value.toString('utf8').trim();
      return candidate || null;
    }
    return String(value);
  };

  const precioDia = normalizeDecimal(row.precio_dia);
  const precioNoche = normalizeDecimal(row.precio_noche);
  const precioBase = precioDia !== null ? precioDia : precioNoche;

  return {
    ...row,
    precio: precioBase,
    precio_dia: precioDia,
    precio_noche: precioNoche,
    capacidad: normalizeInteger(row.capacidad),
    techada: !!row.techada,
    iluminacion: !!row.iluminacion,
    tipo_suelo: normalizeString(row.tipo_suelo),
    estado: typeof row.estado === 'string' ? row.estado : 'disponible',
    imagen_url: normalizeString(row.imagen_url),
  };
};

const obtenerExtensionDesdeMime = (mimetype = '', originalname = '') => {
  if (typeof mimetype === 'string') {
    if (mimetype.includes('png')) return '.png';
    if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return '.jpg';
    if (mimetype.includes('webp')) return '.webp';
  }
  const ext = path.extname(originalname || '').toLowerCase();
  if (ext) return ext;
  return '.png';
};

const escribirImagen = async (buffer, mimetype, originalname) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Buffer de imagen inválido');
  }

  const extension = obtenerExtensionDesdeMime(mimetype, originalname);
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const absolutePath = path.join(imagenesDir, filename);
  await fs.promises.writeFile(absolutePath, buffer);
  return path.posix.join(imagenesPublicPath, filename);
};

const eliminarImagen = async (storedPath) => {
  if (!storedPath) return;
  if (storedPath.startsWith('http')) return;
  const normalized = storedPath.split('?')[0];
  if (!normalized.startsWith(imagenesPublicPath)) return;
  const filename = path.posix.basename(normalized);
  const absolutePath = path.join(imagenesDir, filename);
  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error eliminando imagen de cancha', absolutePath, err);
    }
  }
};

const CanchasModel = {
  crearCancha: async ({
    club_id,
    nombre,
    deporte_id,
    capacidad = null,
    precio_dia = null,
    precio_noche = null,
    tipo_suelo = null,
    techada = 0,
    iluminacion = 0,
    estado = 'disponible',
    imagen_url = null,
  }) => {
    const estadoNormalizado = ESTADOS_VALIDOS.has(estado) ? estado : 'disponible';

    const [result] = await db.query(
      `INSERT INTO canchas
       (club_id, nombre, deporte_id, capacidad, precio_dia, precio_noche, tipo_suelo, techada, iluminacion, estado, imagen_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        club_id,
        nombre,
        deporte_id,
        capacidad === undefined ? null : capacidad,
        precio_dia === undefined ? null : precio_dia,
        precio_noche === undefined ? null : precio_noche,
        tipo_suelo === undefined ? null : tipo_suelo,
        techada ? 1 : 0,
        iluminacion ? 1 : 0,
        estadoNormalizado,
        imagen_url === undefined ? null : imagen_url,
      ]
    );

    const creada = await CanchasModel.obtenerCanchaPorId(result.insertId);
    return creada;
  },

  obtenerCanchaPorId: async (cancha_id) => {
    const [rows] = await db.query(`SELECT * FROM canchas WHERE cancha_id = ?`, [cancha_id]);
    return mapCanchaRow(rows[0] || null);
  },

  perteneceAClub: async (cancha_id, club_id) => {
    const [rows] = await db.query(
      `SELECT 1 FROM canchas WHERE cancha_id = ? AND club_id = ? LIMIT 1`,
      [cancha_id, club_id]
    );
    return rows.length > 0;
  },

  listarPorClub: async (club_id) => {
    const [rows] = await db.query(
      `SELECT cancha_id, club_id, nombre, deporte_id, capacidad, precio_dia, precio_noche,
              tipo_suelo, techada, iluminacion, estado, imagen_url
       FROM canchas
       WHERE club_id = ?
       ORDER BY cancha_id DESC`,
      [club_id]
    );
    return rows.map(mapCanchaRow);
  },

  actualizarCancha: async (
    cancha_id,
    {
      nombre,
      deporte_id,
      capacidad,
      precio_dia,
      precio_noche,
      tipo_suelo,
      techada,
      iluminacion,
      estado,
      imagen_url,
    } = {}
  ) => {
    const existente = await CanchasModel.obtenerCanchaPorId(cancha_id);
    if (!existente) {
      throw new Error('Cancha no encontrada');
    }

    const updates = [];
    const values = [];

    const setNullable = (field, value) => {
      if (value === undefined) return;
      if (value === null) {
        updates.push(`${field} = NULL`);
      } else {
        updates.push(`${field} = ?`);
        values.push(value);
      }
    };

    if (nombre !== undefined) {
      setNullable('nombre', nombre === null ? null : String(nombre));
    }
    if (deporte_id !== undefined) {
      updates.push('deporte_id = ?');
      values.push(deporte_id);
    }
    setNullable('capacidad', capacidad === undefined ? undefined : capacidad);
    setNullable('precio_dia', precio_dia === undefined ? undefined : precio_dia);
    setNullable('precio_noche', precio_noche === undefined ? undefined : precio_noche);
    setNullable('tipo_suelo', tipo_suelo === undefined ? undefined : tipo_suelo);

    if (techada !== undefined) {
      updates.push('techada = ?');
      values.push(techada ? 1 : 0);
    }

    if (iluminacion !== undefined) {
      updates.push('iluminacion = ?');
      values.push(iluminacion ? 1 : 0);
    }

    if (estado !== undefined) {
      const estadoNormalizado = ESTADOS_VALIDOS.has(estado) ? estado : 'disponible';
      updates.push('estado = ?');
      values.push(estadoNormalizado);
    }

    if (imagen_url !== undefined) {
      setNullable('imagen_url', imagen_url);
    }

    if (updates.length === 0) {
      return existente;
    }

    const sql = `UPDATE canchas SET ${updates.join(', ')} WHERE cancha_id = ?`;
    values.push(cancha_id);
    await db.query(sql, values);

    return CanchasModel.obtenerCanchaPorId(cancha_id);
  },

  eliminarCancha: async (cancha_id) => {
    const existente = await CanchasModel.obtenerCanchaPorId(cancha_id);
    if (!existente) {
      return false;
    }

    await db.query(`DELETE FROM canchas WHERE cancha_id = ?`, [cancha_id]);
    if (existente.imagen_url) {
      await eliminarImagen(existente.imagen_url);
    }
    return true;
  },

  guardarImagen: async (cancha_id, file) => {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new Error('Archivo de imagen inválido');
    }

    const storedPath = await escribirImagen(file.buffer, file.mimetype, file.originalname);
    await db.query(`UPDATE canchas SET imagen_url = ? WHERE cancha_id = ?`, [storedPath, cancha_id]);
    return storedPath;
  },

  actualizarImagen: async (cancha_id, file) => {
    const existente = await CanchasModel.obtenerCanchaPorId(cancha_id);
    if (!existente) {
      throw new Error('Cancha no encontrada');
    }

    const storedPath = await CanchasModel.guardarImagen(cancha_id, file);
    if (existente.imagen_url && existente.imagen_url !== storedPath) {
      await eliminarImagen(existente.imagen_url);
    }
    return storedPath;
  },

  obtenerResumen: async (cancha_id) => {
    const cancha = await CanchasModel.obtenerCanchaPorId(cancha_id);
    if (!cancha) {
      return null;
    }

    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);
    const reservasHoy = await ReservasModel.reservasPorCanchaFecha(cancha_id, hoyStr);

    const ahora = hoy.getTime();
    const ocupadaAhora = reservasHoy.some((reserva) => {
      const inicio = new Date(`${reserva.fecha}T${reserva.hora_inicio}`);
      const fin = new Date(`${reserva.fecha}T${reserva.hora_fin}`);
      return inicio.getTime() <= ahora && fin.getTime() > ahora;
    });

    const [proximasRows] = await db.query(
      `SELECT r.reserva_id, r.fecha, r.hora_inicio, r.hora_fin, r.estado
       FROM reservas r
       WHERE r.cancha_id = ?
         AND (r.fecha > CURDATE() OR (r.fecha = CURDATE() AND r.hora_inicio >= DATE_FORMAT(NOW(), '%H:%i:%s')))
       ORDER BY r.fecha ASC, r.hora_inicio ASC
       LIMIT 5`,
      [cancha_id]
    );

    return {
      cancha,
      estado: cancha.estado,
      disponibleAhora: cancha.estado === 'disponible' && !ocupadaAhora,
      enMantenimiento: cancha.estado === 'mantenimiento',
      inactiva: cancha.estado === 'inactiva',
      reservasHoy,
      proximasReservas: proximasRows,
      proximaReserva: proximasRows && proximasRows.length > 0 ? proximasRows[0] : null,
    };
  },
};

CanchasModel._mapCanchaRow = mapCanchaRow;
CanchasModel._imagenes = { dir: imagenesDir, publicPath: imagenesPublicPath };

module.exports = CanchasModel;

