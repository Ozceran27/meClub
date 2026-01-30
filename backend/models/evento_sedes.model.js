const db = require('../config/db');

const normalizeSedeRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    evento_id: row.evento_id === null ? null : Number(row.evento_id),
    cancha_id: row.cancha_id === null ? null : Number(row.cancha_id),
  };
};

const EventoSedesModel = {
  listarPorEvento: async (eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_id, cancha_id
       FROM evento_sedes
       WHERE evento_id = ?
       ORDER BY cancha_id DESC`,
      [eventoId]
    );
    return rows.map((row) => normalizeSedeRow(row));
  },

  obtenerPorId: async (canchaId, eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_id, cancha_id
       FROM evento_sedes
       WHERE cancha_id = ? AND evento_id = ?
       LIMIT 1`,
      [canchaId, eventoId]
    );
    return normalizeSedeRow(rows[0]);
  },

  crear: async (eventoId, payload) => {
    await db.query(
      `INSERT INTO evento_sedes
       (evento_id, cancha_id)
       VALUES (?, ?)`,
      [eventoId, payload.cancha_id]
    );
    return EventoSedesModel.obtenerPorId(payload.cancha_id, eventoId);
  },

  eliminar: async (canchaId, eventoId) => {
    const [result] = await db.query(
      'DELETE FROM evento_sedes WHERE cancha_id = ? AND evento_id = ?',
      [canchaId, eventoId]
    );
    return result.affectedRows > 0;
  },

  eliminarPorEvento: async (eventoId) => {
    const [result] = await db.query('DELETE FROM evento_sedes WHERE evento_id = ?', [
      eventoId,
    ]);
    return result.affectedRows > 0;
  },
};

module.exports = EventoSedesModel;
