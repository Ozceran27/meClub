const db = require('../config/db');

const normalizeEquipoRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    evento_id: row.evento_id === null ? null : Number(row.evento_id),
    equipo_id: row.equipo_id === null ? null : Number(row.equipo_id),
  };
};

const EventoEquiposModel = {
  listarPorEvento: async (eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_equipos.evento_id, evento_equipos.equipo_id, evento_equipos.estado, evento_equipos.origen,
              evento_equipos.creado_en, evento_equipos.actualizado_en,
              equipos_usuarios.nombre AS nombre_equipo, equipos_usuarios.descripcion AS descripcion_equipo
       FROM evento_equipos
       LEFT JOIN equipos_usuarios ON equipos_usuarios.equipo_id = evento_equipos.equipo_id
       WHERE evento_equipos.evento_id = ?
       ORDER BY evento_equipos.creado_en ASC, evento_equipos.equipo_id ASC`,
      [eventoId]
    );
    return rows.map((row) => normalizeEquipoRow(row));
  },

  obtenerPorId: async (eventoEquipoId, eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_equipos.evento_id, evento_equipos.equipo_id, evento_equipos.estado, evento_equipos.origen,
              evento_equipos.creado_en, evento_equipos.actualizado_en,
              equipos_usuarios.nombre AS nombre_equipo, equipos_usuarios.descripcion AS descripcion_equipo
       FROM evento_equipos
       LEFT JOIN equipos_usuarios ON equipos_usuarios.equipo_id = evento_equipos.equipo_id
       WHERE evento_equipos.equipo_id = ? AND evento_equipos.evento_id = ?
       LIMIT 1`,
      [eventoEquipoId, eventoId]
    );
    return normalizeEquipoRow(rows[0]);
  },

  obtenerPorEquipo: async (eventoId, equipoId) => {
    const [rows] = await db.query(
      `SELECT evento_equipos.evento_id, evento_equipos.equipo_id, evento_equipos.estado, evento_equipos.origen,
              evento_equipos.creado_en, evento_equipos.actualizado_en,
              equipos_usuarios.nombre AS nombre_equipo, equipos_usuarios.descripcion AS descripcion_equipo
       FROM evento_equipos
       LEFT JOIN equipos_usuarios ON equipos_usuarios.equipo_id = evento_equipos.equipo_id
       WHERE evento_equipos.evento_id = ? AND evento_equipos.equipo_id = ?
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
    await db.query(
      `INSERT INTO evento_equipos
       (evento_id, equipo_id, estado, origen)
       VALUES (?, ?, ?, ?)`,
      [eventoId, payload.equipo_id, payload.estado, payload.origen ?? 'equipo']
    );
    return EventoEquiposModel.obtenerPorEquipo(eventoId, payload.equipo_id);
  },

  actualizarEstado: async (eventoEquipoId, eventoId, estado) => {
    await db.query(
      `UPDATE evento_equipos
       SET estado = ?
       WHERE equipo_id = ? AND evento_id = ?`,
      [estado, eventoEquipoId, eventoId]
    );
    return EventoEquiposModel.obtenerPorId(eventoEquipoId, eventoId);
  },

  eliminarPorEvento: async (eventoId) => {
    await db.query(
      `DELETE FROM evento_equipos
       WHERE evento_id = ?`,
      [eventoId]
    );
  },
};

module.exports = EventoEquiposModel;
