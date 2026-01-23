const db = require('../config/db');

const normalizePartidoRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    jornada: row.jornada === null ? null : Number(row.jornada),
    orden: row.orden === null ? null : Number(row.orden),
    sede_id: row.sede_id === null ? null : Number(row.sede_id),
    equipo_local_id: row.equipo_local_id === null ? null : Number(row.equipo_local_id),
    equipo_visitante_id: row.equipo_visitante_id === null ? null : Number(row.equipo_visitante_id),
    marcador_local: row.marcador_local === null ? null : Number(row.marcador_local),
    marcador_visitante: row.marcador_visitante === null ? null : Number(row.marcador_visitante),
    ganador_equipo_id: row.ganador_equipo_id === null ? null : Number(row.ganador_equipo_id),
  };
};

const EventoPartidosModel = {
  listarPorEvento: async (eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_partido_id, evento_id, fase, jornada, orden, sede_id, equipo_local_id,
              equipo_visitante_id, fecha, marcador_local, marcador_visitante, ganador_equipo_id,
              estado, creado_en, actualizado_en
       FROM evento_partidos
       WHERE evento_id = ?
       ORDER BY fecha ASC, evento_partido_id ASC`,
      [eventoId]
    );
    return rows.map((row) => normalizePartidoRow(row));
  },

  obtenerPorId: async (partidoId, eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_partido_id, evento_id, fase, jornada, orden, sede_id, equipo_local_id,
              equipo_visitante_id, fecha, marcador_local, marcador_visitante, ganador_equipo_id,
              estado, creado_en, actualizado_en
       FROM evento_partidos
       WHERE evento_partido_id = ? AND evento_id = ?
       LIMIT 1`,
      [partidoId, eventoId]
    );
    return normalizePartidoRow(rows[0]);
  },

  obtenerPorFaseOrden: async (eventoId, fase, orden) => {
    const [rows] = await db.query(
      `SELECT evento_partido_id, evento_id, fase, jornada, orden, sede_id, equipo_local_id,
              equipo_visitante_id, fecha, marcador_local, marcador_visitante, ganador_equipo_id,
              estado, creado_en, actualizado_en
       FROM evento_partidos
       WHERE evento_id = ? AND fase = ? AND orden = ?
       LIMIT 1`,
      [eventoId, fase, orden]
    );
    return normalizePartidoRow(rows[0]);
  },

  crear: async (eventoId, payload) => {
    const [result] = await db.query(
      `INSERT INTO evento_partidos
       (evento_id, fase, jornada, orden, sede_id, equipo_local_id, equipo_visitante_id,
        fecha, marcador_local, marcador_visitante, ganador_equipo_id, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventoId,
        payload.fase,
        payload.jornada,
        payload.orden,
        payload.sede_id,
        payload.equipo_local_id,
        payload.equipo_visitante_id,
        payload.fecha,
        payload.marcador_local,
        payload.marcador_visitante,
        payload.ganador_equipo_id,
        payload.estado,
      ]
    );
    return EventoPartidosModel.obtenerPorId(result.insertId, eventoId);
  },

  actualizar: async (partidoId, eventoId, updates) => {
    const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (fields.length === 0) {
      return EventoPartidosModel.obtenerPorId(partidoId, eventoId);
    }

    const setters = [];
    const values = [];
    fields.forEach(([key, value]) => {
      setters.push(`${key} = ?`);
      values.push(value);
    });

    values.push(partidoId, eventoId);

    await db.query(
      `UPDATE evento_partidos
       SET ${setters.join(', ')}
       WHERE evento_partido_id = ? AND evento_id = ?`,
      values
    );
    return EventoPartidosModel.obtenerPorId(partidoId, eventoId);
  },

  eliminar: async (partidoId, eventoId) => {
    const [result] = await db.query(
      'DELETE FROM evento_partidos WHERE evento_partido_id = ? AND evento_id = ?',
      [partidoId, eventoId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = EventoPartidosModel;
