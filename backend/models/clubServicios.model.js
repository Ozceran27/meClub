const db = require('../config/db');

const parseDiasDisponibles = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return value
      .split(',')
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item));
  }
};

const normalizeRow = (row) => ({
  ...row,
  dias_disponibles: parseDiasDisponibles(row.dias_disponibles),
  precio_valor: row.precio_valor === null ? null : Number(row.precio_valor),
  no_fumar: Boolean(row.no_fumar),
  mas_18: Boolean(row.mas_18),
  comida: Boolean(row.comida),
  eco_friendly: Boolean(row.eco_friendly),
  activo: Boolean(row.activo),
});

const ClubServiciosModel = {
  listarPorClub: async (clubId) => {
    const [rows] = await db.query(
      `SELECT servicio_id, club_id, nombre, modo_acceso, dias_disponibles, hora_inicio, hora_fin,
              imagen_url, ambiente, precio_tipo, precio_valor, no_fumar, mas_18, comida, eco_friendly,
              activo, creado_en, actualizado_en
       FROM club_servicios
       WHERE club_id = ?
       ORDER BY creado_en DESC, servicio_id DESC`,
      [clubId]
    );

    return rows.map((row) => normalizeRow(row));
  },

  obtenerPorId: async (servicioId, clubId) => {
    const [rows] = await db.query(
      `SELECT servicio_id, club_id, nombre, modo_acceso, dias_disponibles, hora_inicio, hora_fin,
              imagen_url, ambiente, precio_tipo, precio_valor, no_fumar, mas_18, comida, eco_friendly,
              activo, creado_en, actualizado_en
       FROM club_servicios
       WHERE servicio_id = ? AND club_id = ?
       LIMIT 1`,
      [servicioId, clubId]
    );

    const row = rows[0];
    return row ? normalizeRow(row) : null;
  },

  crear: async (clubId, payload) => {
    const [result] = await db.query(
      `INSERT INTO club_servicios (
        club_id, nombre, modo_acceso, dias_disponibles, hora_inicio, hora_fin,
        imagen_url, ambiente, precio_tipo, precio_valor, no_fumar, mas_18, comida, eco_friendly, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clubId,
        payload.nombre,
        payload.modo_acceso,
        payload.dias_disponibles,
        payload.hora_inicio,
        payload.hora_fin,
        payload.imagen_url,
        payload.ambiente,
        payload.precio_tipo,
        payload.precio_valor,
        payload.no_fumar ? 1 : 0,
        payload.mas_18 ? 1 : 0,
        payload.comida ? 1 : 0,
        payload.eco_friendly ? 1 : 0,
        payload.activo ? 1 : 0,
      ]
    );

    return ClubServiciosModel.obtenerPorId(result.insertId, clubId);
  },

  actualizar: async (servicioId, clubId, updates) => {
    const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (fields.length === 0) {
      return ClubServiciosModel.obtenerPorId(servicioId, clubId);
    }

    const setters = [];
    const values = [];
    fields.forEach(([key, value]) => {
      setters.push(`${key} = ?`);
      if (['no_fumar', 'mas_18', 'comida', 'eco_friendly', 'activo'].includes(key)) {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    });

    values.push(servicioId, clubId);

    await db.query(
      `UPDATE club_servicios
       SET ${setters.join(', ')}
       WHERE servicio_id = ? AND club_id = ?`,
      values
    );

    return ClubServiciosModel.obtenerPorId(servicioId, clubId);
  },

  eliminar: async (servicioId, clubId) => {
    const [result] = await db.query(
      'DELETE FROM club_servicios WHERE servicio_id = ? AND club_id = ?',
      [servicioId, clubId]
    );

    return result.affectedRows > 0;
  },

  reemplazarSeleccion: async (clubId, servicioIds = []) => {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query('UPDATE club_servicios SET activo = 0 WHERE club_id = ?', [clubId]);

      if (servicioIds.length) {
        await connection.query(
          'UPDATE club_servicios SET activo = 1 WHERE club_id = ? AND servicio_id IN (?)',
          [clubId, servicioIds]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return ClubServiciosModel.listarPorClub(clubId);
  },
};

module.exports = ClubServiciosModel;
