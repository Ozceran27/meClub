const db = require('../config/db');

const normalizePartidoRow = (row) => {
  if (!row) return null;
  const partidoId = row.partido_id ?? row.evento_partido_id ?? null;
  const canchaId = row.cancha_id ?? row.sede_id ?? null;
  const golesLocal = row.goles_local ?? row.marcador_local ?? null;
  const golesVisitante = row.goles_visitante ?? row.marcador_visitante ?? null;
  return {
    ...row,
    evento_partido_id: partidoId === null ? null : Number(partidoId),
    partido_id: partidoId === null ? null : Number(partidoId),
    evento_id: row.evento_id === null ? null : Number(row.evento_id),
    jornada: row.jornada === null ? null : Number(row.jornada),
    orden: row.orden === null ? null : Number(row.orden),
    sede_id: canchaId === null ? null : Number(canchaId),
    cancha_id: canchaId === null ? null : Number(canchaId),
    equipo_local_id: row.equipo_local_id === null ? null : Number(row.equipo_local_id),
    equipo_visitante_id: row.equipo_visitante_id === null ? null : Number(row.equipo_visitante_id),
    marcador_local: golesLocal === null ? null : Number(golesLocal),
    marcador_visitante: golesVisitante === null ? null : Number(golesVisitante),
    goles_local: golesLocal === null ? null : Number(golesLocal),
    goles_visitante: golesVisitante === null ? null : Number(golesVisitante),
    ganador_equipo_id: row.ganador_equipo_id === null ? null : Number(row.ganador_equipo_id),
  };
};

const mapPartidoPayload = (payload) => {
  if (!payload) return {};
  return {
    ...payload,
    cancha_id: payload.cancha_id ?? payload.sede_id,
    goles_local: payload.goles_local ?? payload.marcador_local,
    goles_visitante: payload.goles_visitante ?? payload.marcador_visitante,
  };
};

const mapPartidoUpdates = (updates) => {
  if (!updates) return {};
  const mapped = { ...updates };
  if (mapped.sede_id !== undefined && mapped.cancha_id === undefined) {
    mapped.cancha_id = mapped.sede_id;
  }
  if (mapped.marcador_local !== undefined && mapped.goles_local === undefined) {
    mapped.goles_local = mapped.marcador_local;
  }
  if (mapped.marcador_visitante !== undefined && mapped.goles_visitante === undefined) {
    mapped.goles_visitante = mapped.marcador_visitante;
  }
  delete mapped.sede_id;
  delete mapped.marcador_local;
  delete mapped.marcador_visitante;
  return mapped;
};

const EventoPartidosModel = {
  listarPorEvento: async (eventoId) => {
    const [rows] = await db.query(
      `SELECT partido_id, evento_id, fase, jornada, orden, cancha_id, equipo_local_id,
              equipo_visitante_id, fecha, goles_local, goles_visitante, ganador_equipo_id,
              estado, creado_en, actualizado_en
       FROM evento_partidos
       WHERE evento_id = ?
       ORDER BY fecha ASC, partido_id ASC`,
      [eventoId]
    );
    return rows.map((row) => normalizePartidoRow(row));
  },

  obtenerPorId: async (partidoId, eventoId) => {
    const [rows] = await db.query(
      `SELECT partido_id, evento_id, fase, jornada, orden, cancha_id, equipo_local_id,
              equipo_visitante_id, fecha, goles_local, goles_visitante, ganador_equipo_id,
              estado, creado_en, actualizado_en
       FROM evento_partidos
       WHERE partido_id = ? AND evento_id = ?
       LIMIT 1`,
      [partidoId, eventoId]
    );
    return normalizePartidoRow(rows[0]);
  },

  obtenerPorFaseOrden: async (eventoId, fase, orden) => {
    const [rows] = await db.query(
      `SELECT partido_id, evento_id, fase, jornada, orden, cancha_id, equipo_local_id,
              equipo_visitante_id, fecha, goles_local, goles_visitante, ganador_equipo_id,
              estado, creado_en, actualizado_en
       FROM evento_partidos
       WHERE evento_id = ? AND fase = ? AND orden = ?
       LIMIT 1`,
      [eventoId, fase, orden]
    );
    return normalizePartidoRow(rows[0]);
  },

  crear: async (eventoId, payload) => {
    const mapped = mapPartidoPayload(payload);
    const [result] = await db.query(
      `INSERT INTO evento_partidos
       (evento_id, fase, jornada, orden, cancha_id, equipo_local_id, equipo_visitante_id,
        fecha, goles_local, goles_visitante, ganador_equipo_id, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventoId,
        mapped.fase,
        mapped.jornada,
        mapped.orden,
        mapped.cancha_id,
        mapped.equipo_local_id,
        mapped.equipo_visitante_id,
        mapped.fecha,
        mapped.goles_local,
        mapped.goles_visitante,
        mapped.ganador_equipo_id,
        mapped.estado,
      ]
    );
    return EventoPartidosModel.obtenerPorId(result.insertId, eventoId);
  },

  actualizar: async (partidoId, eventoId, updates) => {
    const mappedUpdates = mapPartidoUpdates(updates);
    const fields = Object.entries(mappedUpdates).filter(([, value]) => value !== undefined);
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
       WHERE partido_id = ? AND evento_id = ?`,
      values
    );
    return EventoPartidosModel.obtenerPorId(partidoId, eventoId);
  },

  eliminar: async (partidoId, eventoId) => {
    const [result] = await db.query(
      'DELETE FROM evento_partidos WHERE partido_id = ? AND evento_id = ?',
      [partidoId, eventoId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = EventoPartidosModel;
