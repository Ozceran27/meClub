const db = require('../config/db');

const parseCanchasAplicadas = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item > 0)
      )
    );
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return Array.from(
        new Set(
          parsed
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0)
        )
      );
    }
  } catch (err) {
    // continue with fallback parsing
  }
  return Array.from(
    new Set(
      trimmed
        .split(',')
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
};

const normalizeRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    valor: row.valor === null ? null : Number(row.valor),
    canchas_aplicadas: parseCanchasAplicadas(row.canchas_aplicadas),
    activo: row.activo === undefined ? true : Boolean(row.activo),
  };
};

const PromocionesModel = {
  listarPorClub: async (clubId) => {
    const [rows] = await db.query(
      `SELECT promocion_id, club_id, nombre, fecha_inicio, fecha_fin, tipo_descuento, valor,
              canchas_aplicadas, activo, creado_en, actualizado_en
       FROM promociones
       WHERE club_id = ?
       ORDER BY fecha_inicio DESC, promocion_id DESC`,
      [clubId]
    );
    return rows.map((row) => normalizeRow(row));
  },

  obtenerPorId: async (promocionId, clubId) => {
    const [rows] = await db.query(
      `SELECT promocion_id, club_id, nombre, fecha_inicio, fecha_fin, tipo_descuento, valor,
              canchas_aplicadas, activo, creado_en, actualizado_en
       FROM promociones
       WHERE promocion_id = ? AND club_id = ?
       LIMIT 1`,
      [promocionId, clubId]
    );
    return normalizeRow(rows[0]);
  },

  crear: async (clubId, payload) => {
    const [result] = await db.query(
      `INSERT INTO promociones
       (club_id, nombre, fecha_inicio, fecha_fin, tipo_descuento, valor, canchas_aplicadas, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clubId,
        payload.nombre,
        payload.fecha_inicio,
        payload.fecha_fin,
        payload.tipo_descuento,
        payload.valor,
        payload.canchas_aplicadas,
        payload.activo ? 1 : 0,
      ]
    );
    return PromocionesModel.obtenerPorId(result.insertId, clubId);
  },

  actualizar: async (promocionId, clubId, updates) => {
    const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (fields.length === 0) {
      return PromocionesModel.obtenerPorId(promocionId, clubId);
    }

    const setters = [];
    const values = [];

    fields.forEach(([key, value]) => {
      setters.push(`${key} = ?`);
      if (key === 'activo') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    });

    values.push(promocionId, clubId);

    await db.query(
      `UPDATE promociones
       SET ${setters.join(', ')}
       WHERE promocion_id = ? AND club_id = ?`,
      values
    );

    return PromocionesModel.obtenerPorId(promocionId, clubId);
  },

  eliminar: async (promocionId, clubId) => {
    const [result] = await db.query(
      'DELETE FROM promociones WHERE promocion_id = ? AND club_id = ?',
      [promocionId, clubId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = { PromocionesModel, parseCanchasAplicadas };
