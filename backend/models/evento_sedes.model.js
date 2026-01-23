const db = require('../config/db');

const normalizeSedeRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    latitud: row.latitud === null ? null : Number(row.latitud),
    longitud: row.longitud === null ? null : Number(row.longitud),
  };
};

const EventoSedesModel = {
  listarPorEvento: async (eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_sede_id, evento_id, nombre, direccion, provincia_id, localidad_id,
              latitud, longitud, creado_en, actualizado_en
       FROM evento_sedes
       WHERE evento_id = ?
       ORDER BY evento_sede_id DESC`,
      [eventoId]
    );
    return rows.map((row) => normalizeSedeRow(row));
  },

  obtenerPorId: async (sedeId, eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_sede_id, evento_id, nombre, direccion, provincia_id, localidad_id,
              latitud, longitud, creado_en, actualizado_en
       FROM evento_sedes
       WHERE evento_sede_id = ? AND evento_id = ?
       LIMIT 1`,
      [sedeId, eventoId]
    );
    return normalizeSedeRow(rows[0]);
  },

  crear: async (eventoId, payload) => {
    const [result] = await db.query(
      `INSERT INTO evento_sedes
       (evento_id, nombre, direccion, provincia_id, localidad_id, latitud, longitud)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        eventoId,
        payload.nombre,
        payload.direccion,
        payload.provincia_id,
        payload.localidad_id,
        payload.latitud,
        payload.longitud,
      ]
    );
    return EventoSedesModel.obtenerPorId(result.insertId, eventoId);
  },

  actualizar: async (sedeId, eventoId, updates) => {
    const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (fields.length === 0) {
      return EventoSedesModel.obtenerPorId(sedeId, eventoId);
    }

    const setters = [];
    const values = [];
    fields.forEach(([key, value]) => {
      setters.push(`${key} = ?`);
      values.push(value);
    });

    values.push(sedeId, eventoId);

    await db.query(
      `UPDATE evento_sedes
       SET ${setters.join(', ')}
       WHERE evento_sede_id = ? AND evento_id = ?`,
      values
    );
    return EventoSedesModel.obtenerPorId(sedeId, eventoId);
  },

  eliminar: async (sedeId, eventoId) => {
    const [result] = await db.query(
      'DELETE FROM evento_sedes WHERE evento_sede_id = ? AND evento_id = ?',
      [sedeId, eventoId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = EventoSedesModel;
