const db = require('../config/db');

const normalizeEquipoRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    equipo_id: row.equipo_id === null ? null : Number(row.equipo_id),
  };
};

const EventoEquiposModel = {
  listarPorEvento: async (eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_equipo_id, evento_id, equipo_id, nombre_equipo, estado, creado_en, actualizado_en
       FROM evento_equipos
       WHERE evento_id = ?
       ORDER BY evento_equipo_id DESC`,
      [eventoId]
    );
    return rows.map((row) => normalizeEquipoRow(row));
  },

  obtenerPorId: async (eventoEquipoId, eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_equipo_id, evento_id, equipo_id, nombre_equipo, estado, creado_en, actualizado_en
       FROM evento_equipos
       WHERE evento_equipo_id = ? AND evento_id = ?
       LIMIT 1`,
      [eventoEquipoId, eventoId]
    );
    return normalizeEquipoRow(rows[0]);
  },

  obtenerPorEquipo: async (eventoId, equipoId) => {
    const [rows] = await db.query(
      `SELECT evento_equipo_id, evento_id, equipo_id, nombre_equipo, estado, creado_en, actualizado_en
       FROM evento_equipos
       WHERE evento_id = ? AND equipo_id = ?
       LIMIT 1`,
      [eventoId, equipoId]
    );
    return normalizeEquipoRow(rows[0]);
  },

  contarPorEvento: async (eventoId, { estado } = {}) => {
    const filters = ['evento_id = ?'];
    const values = [eventoId];
    if (estado) {
      filters.push('estado = ?');
      values.push(estado);
    }
    const [rows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM evento_equipos
       WHERE ${filters.join(' AND ')}`,
      values
    );
    return Number(rows[0]?.total || 0);
  },

  crear: async (eventoId, payload) => {
    const [result] = await db.query(
      `INSERT INTO evento_equipos
       (evento_id, equipo_id, nombre_equipo, estado)
       VALUES (?, ?, ?, ?)`,
      [eventoId, payload.equipo_id, payload.nombre_equipo, payload.estado]
    );
    return EventoEquiposModel.obtenerPorId(result.insertId, eventoId);
  },

  actualizarEstado: async (eventoEquipoId, eventoId, estado) => {
    await db.query(
      `UPDATE evento_equipos
       SET estado = ?
       WHERE evento_equipo_id = ? AND evento_id = ?`,
      [estado, eventoEquipoId, eventoId]
    );
    return EventoEquiposModel.obtenerPorId(eventoEquipoId, eventoId);
  },
};

module.exports = EventoEquiposModel;
