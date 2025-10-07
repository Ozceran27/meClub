const db = require('../config/db');
const { normalizeLogoValue, prepareLogoValue } = require('../utils/logoStorage');

const toNullableNumber = (value) => {
  if (value === undefined || value === null) return null;
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : null;
};

const mapClubRow = (row) => {
  if (!row || typeof row !== 'object') return row;

  return {
    ...row,
    foto_logo: normalizeLogoValue(row.foto_logo),
    latitud: row.latitud === null ? null : toNullableNumber(row.latitud),
    longitud: row.longitud === null ? null : toNullableNumber(row.longitud),
    telefono_contacto:
      row.telefono_contacto === undefined ? null : row.telefono_contacto || null,
    email_contacto:
      row.email_contacto === undefined ? null : row.email_contacto || null,
    direccion: row.direccion === undefined ? null : row.direccion || null,
    google_place_id:
      row.google_place_id === undefined ? null : row.google_place_id || null,
  };
};

const normalizeNullableTrimmedString = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} debe ser una cadena o null`);
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  return trimmed;
};

const normalizeNullableInteger = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const numeric = Number(value);
  if (!Number.isInteger(numeric)) {
    throw new Error(`${fieldName} debe ser numérico o null`);
  }

  return numeric;
};

const normalizeNullableFloat = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldName} debe ser numérico o null`);
  }

  return numeric;
};

const ClubesModel = {
  crearClub: async ({
    nombre,
    descripcion,
    usuario_id,
    nivel_id = 1,
    foto_logo = null,
    foto_portada = null,
    provincia_id = null,
    localidad_id = null,
    telefono_contacto = null,
    email_contacto = null,
    direccion = null,
    latitud = null,
    longitud = null,
    google_place_id = null,
  }) => {
    const { value: logoValue } = prepareLogoValue(foto_logo === undefined ? null : foto_logo);
    const descripcionValue = normalizeNullableTrimmedString(descripcion, 'descripcion');
    const telefonoValue = normalizeNullableTrimmedString(telefono_contacto, 'telefono_contacto');
    const emailValue = normalizeNullableTrimmedString(email_contacto, 'email_contacto');
    const direccionValue = normalizeNullableTrimmedString(direccion, 'direccion');
    const latitudValue = normalizeNullableFloat(latitud, 'latitud');
    const longitudValue = normalizeNullableFloat(longitud, 'longitud');
    const provinciaValue = normalizeNullableInteger(provincia_id, 'provincia_id');
    const localidadValue = normalizeNullableInteger(localidad_id, 'localidad_id');
    const placeIdValue = normalizeNullableTrimmedString(google_place_id, 'google_place_id');

    const [result] = await db.query(
      `INSERT INTO clubes
       (nombre, descripcion, telefono_contacto, email_contacto, direccion, latitud, longitud, google_place_id,
        usuario_id, nivel_id, foto_logo, foto_portada, provincia_id, localidad_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcionValue,
        telefonoValue,
        emailValue,
        direccionValue,
        latitudValue,
        longitudValue,
        placeIdValue,
        usuario_id,
        nivel_id,
        logoValue,
        foto_portada,
        provinciaValue,
        localidadValue,
      ]
    );

    return mapClubRow({
      club_id: result.insertId,
      nombre,
      descripcion: descripcionValue,
      usuario_id,
      nivel_id,
      foto_logo: logoValue,
      foto_portada,
      provincia_id: provinciaValue,
      localidad_id: localidadValue,
      telefono_contacto: telefonoValue,
      email_contacto: emailValue,
      direccion: direccionValue,
      latitud: latitudValue,
      longitud: longitudValue,
      google_place_id: placeIdValue,
    });
  },

  obtenerClubPorPropietario: async (usuario_id) => {
    const [rows] = await db.query('SELECT * FROM clubes WHERE usuario_id = ? LIMIT 1', [usuario_id]);
    return mapClubRow(rows[0] || null);
  },

  obtenerMisCanchas: async (club_id) => {
    const [rows] = await db.query(
      `SELECT c.cancha_id, c.club_id, c.nombre, c.deporte_id, c.capacidad, c.precio, c.precio_dia,
              c.precio_noche, c.tipo_suelo, c.techada, c.iluminacion, c.estado, c.imagen_url,
              d.nombre AS deporte_nombre
       FROM canchas c
       LEFT JOIN deportes d ON d.deporte_id = c.deporte_id
       WHERE c.club_id = ?
       ORDER BY c.cancha_id DESC`,
      [club_id]
    );

    return rows.map((row) => ({
      cancha_id: row.cancha_id,
      club_id: row.club_id,
      nombre: row.nombre,
      deporte_id: row.deporte_id,
      deporte_nombre: row.deporte_nombre || null,
      capacidad: row.capacidad === null || row.capacidad === undefined ? null : Number(row.capacidad),
      precio: row.precio === null || row.precio === undefined ? null : Number(row.precio),
      precio_dia:
        row.precio_dia === null || row.precio_dia === undefined ? null : Number(row.precio_dia),
      precio_noche:
        row.precio_noche === null || row.precio_noche === undefined ? null : Number(row.precio_noche),
      tipo_suelo: row.tipo_suelo == null ? null : row.tipo_suelo,
      techada: !!row.techada,
      iluminacion: !!row.iluminacion,
      estado: row.estado || 'disponible',
      imagen_url: row.imagen_url == null ? null : row.imagen_url,
    }));
  },

  obtenerClubPorId: async (club_id) => {
    const [rows] = await db.query(`SELECT * FROM clubes WHERE club_id = ?`, [club_id]);
    return mapClubRow(rows[0] || null);
  },

  actualizarPorId: async (
    club_id,
    {
      nombre,
      descripcion,
      foto_logo,
      provincia_id,
      localidad_id,
      telefono_contacto,
      email_contacto,
      direccion,
      latitud,
      longitud,
      google_place_id,
    } = {}
  ) => {
    const existente = await ClubesModel.obtenerClubPorId(club_id);
    if (!existente) {
      throw new Error('Club no encontrado');
    }

    const updates = [];
    const values = [];

    const setField = (fieldName, normalizedValue) => {
      if (normalizedValue === undefined) return;
      if (normalizedValue === null) {
        updates.push(`${fieldName} = NULL`);
      } else {
        updates.push(`${fieldName} = ?`);
        values.push(normalizedValue);
      }
    };

    setField('nombre', normalizeNullableTrimmedString(nombre, 'nombre'));
    setField('descripcion', normalizeNullableTrimmedString(descripcion, 'descripcion'));
    setField(
      'telefono_contacto',
      normalizeNullableTrimmedString(telefono_contacto, 'telefono_contacto')
    );
    setField('email_contacto', normalizeNullableTrimmedString(email_contacto, 'email_contacto'));
    setField('direccion', normalizeNullableTrimmedString(direccion, 'direccion'));
    setField('google_place_id', normalizeNullableTrimmedString(google_place_id, 'google_place_id'));

    if (foto_logo !== undefined) {
      const { value: logoValue, shouldUpdate } = prepareLogoValue(foto_logo);
      if (shouldUpdate) {
        if (logoValue === null) {
          updates.push('foto_logo = NULL');
        } else {
          updates.push('foto_logo = ?');
          values.push(logoValue);
        }
      }
    }

    setField('provincia_id', normalizeNullableInteger(provincia_id, 'provincia_id'));
    setField('localidad_id', normalizeNullableInteger(localidad_id, 'localidad_id'));
    setField('latitud', normalizeNullableFloat(latitud, 'latitud'));
    setField('longitud', normalizeNullableFloat(longitud, 'longitud'));

    if (updates.length === 0) {
      return existente;
    }

    const sql = `UPDATE clubes SET ${updates.join(', ')} WHERE club_id = ?`;
    values.push(club_id);

    await db.query(sql, values);

    const actualizado = await ClubesModel.obtenerClubPorId(club_id);

    return actualizado;
  },

  obtenerResumen: async (club_id) => {
    const [[{ total: courtsAvailable = 0 } = {}]] = await db.query(
      'SELECT COUNT(*) AS total FROM canchas WHERE club_id = ?',
      [club_id]
    );

    const [[{ total: reservasHoy = 0 } = {}]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ? AND r.fecha = CURDATE()`,
      [club_id]
    );

    const reservasSemanaQuery = `
      SELECT COUNT(*) AS total
      FROM reservas r
      JOIN canchas c ON c.cancha_id = r.cancha_id
      WHERE c.club_id = ?
        AND YEARWEEK(r.fecha, 1) = YEARWEEK(CURDATE(), 1)
    `;

    const [[{ total: reservasSemana = 0 } = {}]] = await db.query(
      reservasSemanaQuery,
      [club_id]
    );

    const [[{ total: economiaMes = 0 } = {}]] = await db.query(
      `SELECT COALESCE(SUM(r.monto), 0) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND DATE_FORMAT(r.fecha, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
      [club_id]
    );

    return { courtsAvailable, reservasHoy, reservasSemana, economiaMes };
  },
};

module.exports = ClubesModel;
