const db = require('../config/db');

const normalizePosicionRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    equipo_id: row.equipo_id === null ? null : Number(row.equipo_id),
    puntos: row.puntos === null ? null : Number(row.puntos),
    orden: row.orden === null ? null : Number(row.orden),
  };
};

const EventoPosicionesModel = {
  listarPorEvento: async (eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_posicion_id, evento_id, equipo_id, puntos, partidos_jugados,
              victorias, empates, derrotas, goles_favor, goles_contra, orden, creado_en, actualizado_en
       FROM evento_posiciones
       WHERE evento_id = ?
       ORDER BY orden ASC, puntos DESC, goles_favor DESC`,
      [eventoId]
    );
    return rows.map((row) => normalizePosicionRow(row));
  },

  obtenerPorId: async (posicionId, eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_posicion_id, evento_id, equipo_id, puntos, partidos_jugados,
              victorias, empates, derrotas, goles_favor, goles_contra, orden, creado_en, actualizado_en
       FROM evento_posiciones
       WHERE evento_posicion_id = ? AND evento_id = ?
       LIMIT 1`,
      [posicionId, eventoId]
    );
    return normalizePosicionRow(rows[0]);
  },

  crear: async (eventoId, payload) => {
    const [result] = await db.query(
      `INSERT INTO evento_posiciones
       (evento_id, equipo_id, puntos, partidos_jugados, victorias, empates, derrotas, goles_favor, goles_contra, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventoId,
        payload.equipo_id,
        payload.puntos,
        payload.partidos_jugados,
        payload.victorias,
        payload.empates,
        payload.derrotas,
        payload.goles_favor,
        payload.goles_contra,
        payload.orden,
      ]
    );
    return EventoPosicionesModel.obtenerPorId(result.insertId, eventoId);
  },

  actualizar: async (posicionId, eventoId, updates) => {
    const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (fields.length === 0) {
      return EventoPosicionesModel.obtenerPorId(posicionId, eventoId);
    }

    const setters = [];
    const values = [];
    fields.forEach(([key, value]) => {
      setters.push(`${key} = ?`);
      values.push(value);
    });

    values.push(posicionId, eventoId);

    await db.query(
      `UPDATE evento_posiciones
       SET ${setters.join(', ')}
       WHERE evento_posicion_id = ? AND evento_id = ?`,
      values
    );
    return EventoPosicionesModel.obtenerPorId(posicionId, eventoId);
  },

  eliminar: async (posicionId, eventoId) => {
    const [result] = await db.query(
      'DELETE FROM evento_posiciones WHERE evento_posicion_id = ? AND evento_id = ?',
      [posicionId, eventoId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = EventoPosicionesModel;
