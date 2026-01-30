const db = require('../config/db');

const normalizePosicionRow = (row) => {
  if (!row) return null;
  const posicionId = row.evento_posicion_id ?? row.equipo_id ?? null;
  const partidosJugados = row.partidos_jugados ?? row.pj ?? null;
  const victorias = row.victorias ?? row.pg ?? null;
  const empates = row.empates ?? row.pe ?? null;
  const derrotas = row.derrotas ?? row.pp ?? null;
  const golesFavor = row.goles_favor ?? row.gf ?? null;
  const golesContra = row.goles_contra ?? row.gc ?? null;
  return {
    ...row,
    evento_posicion_id: posicionId === null ? null : Number(posicionId),
    evento_id: row.evento_id === null ? null : Number(row.evento_id),
    equipo_id: row.equipo_id === null ? null : Number(row.equipo_id),
    puntos: row.puntos === null ? null : Number(row.puntos),
    partidos_jugados: partidosJugados === null ? null : Number(partidosJugados),
    pj: partidosJugados === null ? null : Number(partidosJugados),
    victorias: victorias === null ? null : Number(victorias),
    pg: victorias === null ? null : Number(victorias),
    empates: empates === null ? null : Number(empates),
    pe: empates === null ? null : Number(empates),
    derrotas: derrotas === null ? null : Number(derrotas),
    pp: derrotas === null ? null : Number(derrotas),
    goles_favor: golesFavor === null ? null : Number(golesFavor),
    gf: golesFavor === null ? null : Number(golesFavor),
    goles_contra: golesContra === null ? null : Number(golesContra),
    gc: golesContra === null ? null : Number(golesContra),
    orden: row.orden === null ? null : Number(row.orden),
  };
};

const EventoPosicionesModel = {
  listarPorEvento: async (eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_id, equipo_id, puntos, pj, pg, pe, pp, gf, gc,
              orden, creado_en, actualizado_en
       FROM evento_posiciones
       WHERE evento_id = ?
       ORDER BY puntos DESC, pj DESC, gf DESC, orden ASC`,
      [eventoId]
    );
    return rows.map((row) => normalizePosicionRow(row));
  },

  obtenerPorId: async (posicionId, eventoId) => {
    const [rows] = await db.query(
      `SELECT evento_id, equipo_id, puntos, pj, pg, pe, pp, gf, gc,
              orden, creado_en, actualizado_en
       FROM evento_posiciones
       WHERE equipo_id = ? AND evento_id = ?
       LIMIT 1`,
      [posicionId, eventoId]
    );
    return normalizePosicionRow(rows[0]);
  },

  crear: async (eventoId, payload) => {
    const partidosJugados = payload.partidos_jugados ?? payload.pj ?? 0;
    const victorias = payload.victorias ?? payload.pg ?? 0;
    const empates = payload.empates ?? payload.pe ?? 0;
    const derrotas = payload.derrotas ?? payload.pp ?? 0;
    const golesFavor = payload.goles_favor ?? payload.gf ?? 0;
    const golesContra = payload.goles_contra ?? payload.gc ?? 0;
    const [result] = await db.query(
      `INSERT INTO evento_posiciones
       (evento_id, equipo_id, puntos, pj, pg, pe, pp, gf, gc, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventoId,
        payload.equipo_id,
        payload.puntos,
        partidosJugados,
        victorias,
        empates,
        derrotas,
        golesFavor,
        golesContra,
        payload.orden,
      ]
    );
    return EventoPosicionesModel.obtenerPorId(payload.equipo_id ?? result.insertId, eventoId);
  },

  actualizar: async (posicionId, eventoId, updates) => {
    const mappedUpdates = { ...updates };
    if (mappedUpdates.partidos_jugados !== undefined && mappedUpdates.pj === undefined) {
      mappedUpdates.pj = mappedUpdates.partidos_jugados;
    }
    if (mappedUpdates.victorias !== undefined && mappedUpdates.pg === undefined) {
      mappedUpdates.pg = mappedUpdates.victorias;
    }
    if (mappedUpdates.empates !== undefined && mappedUpdates.pe === undefined) {
      mappedUpdates.pe = mappedUpdates.empates;
    }
    if (mappedUpdates.derrotas !== undefined && mappedUpdates.pp === undefined) {
      mappedUpdates.pp = mappedUpdates.derrotas;
    }
    if (mappedUpdates.goles_favor !== undefined && mappedUpdates.gf === undefined) {
      mappedUpdates.gf = mappedUpdates.goles_favor;
    }
    if (mappedUpdates.goles_contra !== undefined && mappedUpdates.gc === undefined) {
      mappedUpdates.gc = mappedUpdates.goles_contra;
    }
    delete mappedUpdates.partidos_jugados;
    delete mappedUpdates.victorias;
    delete mappedUpdates.empates;
    delete mappedUpdates.derrotas;
    delete mappedUpdates.goles_favor;
    delete mappedUpdates.goles_contra;
    const fields = Object.entries(mappedUpdates).filter(([, value]) => value !== undefined);
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
       WHERE equipo_id = ? AND evento_id = ?`,
      values
    );
    return EventoPosicionesModel.obtenerPorId(posicionId, eventoId);
  },

  eliminar: async (posicionId, eventoId) => {
    const [result] = await db.query(
      'DELETE FROM evento_posiciones WHERE equipo_id = ? AND evento_id = ?',
      [posicionId, eventoId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = EventoPosicionesModel;
