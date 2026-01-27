const db = require('../config/db');

const toNullableInteger = (value) => {
  if (value === undefined || value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveLimiteEquipos = (row) => {
  if (!row) return null;
  return toNullableInteger(row.limite_equipos ?? row.cantidad_equipos);
};

const normalizeEventoRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    limite_equipos: resolveLimiteEquipos(row),
  };
};

const EventosModel = {
  listarPorClub: async (clubId, { provinciaId } = {}) => {
    const filters = ['club_id = ?'];
    const values = [clubId];
    if (provinciaId !== undefined && provinciaId !== null) {
      filters.push('provincia_id = ?');
      values.push(provinciaId);
    }

    const [rows] = await db.query(
      `SELECT evento_id, club_id, nombre, tipo, descripcion, estado, fecha_inicio, fecha_fin,
              hora_inicio, provincia_id, zona, deporte_id, cantidad_equipos, valor_inscripcion,
              premio_1, premio_2, premio_3, imagen_url, creado_en, actualizado_en
       FROM eventos
       WHERE ${filters.join(' AND ')}
       ORDER BY creado_en DESC, evento_id DESC`,
      values
    );
    return rows.map((row) => normalizeEventoRow(row));
  },
  listarGlobales: async ({ provinciaId, zona } = {}) => {
    const values = [];
    let whereClause = "eventos.zona = 'nacional'";

    if (zona === 'regional') {
      if (provinciaId === undefined || provinciaId === null) {
        return [];
      }
      whereClause = 'eventos.zona = ? AND eventos.provincia_id = ?';
      values.push('regional', provinciaId);
    } else if (zona === 'nacional') {
      whereClause = 'eventos.zona = ?';
      values.push('nacional');
    } else if (provinciaId !== undefined && provinciaId !== null) {
      whereClause =
        "(eventos.zona = 'nacional' OR (eventos.zona = 'regional' AND eventos.provincia_id = ?))";
      values.push(provinciaId);
    }

    const [rows] = await db.query(
      `SELECT eventos.evento_id, eventos.club_id, eventos.nombre, eventos.tipo, eventos.descripcion,
              eventos.estado, eventos.fecha_inicio, eventos.fecha_fin, eventos.hora_inicio,
              eventos.provincia_id, eventos.zona, eventos.deporte_id, eventos.cantidad_equipos,
              eventos.valor_inscripcion, eventos.premio_1, eventos.premio_2, eventos.premio_3,
              eventos.imagen_url, eventos.creado_en, eventos.actualizado_en,
              clubes.nombre AS club_nombre
       FROM eventos
       LEFT JOIN clubes ON clubes.club_id = eventos.club_id
       WHERE ${whereClause}
       ORDER BY eventos.creado_en DESC, eventos.evento_id DESC`,
      values
    );
    return rows.map((row) => normalizeEventoRow(row));
  },

  obtenerPorId: async (eventoId, clubId) => {
    const [rows] = await db.query(
      `SELECT evento_id, club_id, nombre, tipo, descripcion, estado, fecha_inicio, fecha_fin,
              hora_inicio, provincia_id, zona, deporte_id, cantidad_equipos, valor_inscripcion,
              premio_1, premio_2, premio_3, imagen_url, creado_en, actualizado_en
       FROM eventos
       WHERE evento_id = ? AND club_id = ?
       LIMIT 1`,
      [eventoId, clubId]
    );
    return normalizeEventoRow(rows[0]);
  },

  crear: async (clubId, payload) => {
    const cantidadEquipos =
      payload.cantidad_equipos ?? payload.limite_equipos ?? null;
    const [result] = await db.query(
      `INSERT INTO eventos
       (club_id, nombre, tipo, descripcion, estado, fecha_inicio, fecha_fin, hora_inicio,
        provincia_id, zona, deporte_id, cantidad_equipos, valor_inscripcion, premio_1, premio_2, premio_3,
        imagen_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clubId,
        payload.nombre,
        payload.tipo,
        payload.descripcion,
        payload.estado,
        payload.fecha_inicio,
        payload.fecha_fin,
        payload.hora_inicio,
        payload.provincia_id,
        payload.zona,
        payload.deporte_id,
        cantidadEquipos,
        payload.valor_inscripcion ?? 0,
        payload.premio_1,
        payload.premio_2,
        payload.premio_3,
        payload.imagen_url ?? null,
      ]
    );
    return EventosModel.obtenerPorId(result.insertId, clubId);
  },

  actualizar: async (eventoId, clubId, updates) => {
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.limite_equipos !== undefined) {
      normalizedUpdates.cantidad_equipos = normalizedUpdates.limite_equipos;
      delete normalizedUpdates.limite_equipos;
    }

    const fields = Object.entries(normalizedUpdates).filter(([, value]) => value !== undefined);
    if (fields.length === 0) {
      return EventosModel.obtenerPorId(eventoId, clubId);
    }

    const setters = [];
    const values = [];
    fields.forEach(([key, value]) => {
      setters.push(`${key} = ?`);
      values.push(value);
    });

    values.push(eventoId, clubId);

    await db.query(
      `UPDATE eventos
       SET ${setters.join(', ')}
       WHERE evento_id = ? AND club_id = ?`,
      values
    );
    return EventosModel.obtenerPorId(eventoId, clubId);
  },

  eliminar: async (eventoId, clubId) => {
    const [result] = await db.query(
      'DELETE FROM eventos WHERE evento_id = ? AND club_id = ?',
      [eventoId, clubId]
    );
    return result.affectedRows > 0;
  },

  finalizarEventosVencidos: async (referenceDate = new Date()) => {
    const [rows] = await db.query(
      `SELECT evento_id, club_id
       FROM eventos
       WHERE estado <> 'finalizado'
         AND (
           (tipo = 'amistoso'
             AND fecha_inicio IS NOT NULL
             AND fecha_inicio < DATE_SUB(?, INTERVAL 1 DAY))
           OR
           (tipo IN ('torneo', 'copa')
             AND fecha_fin IS NOT NULL
             AND fecha_fin < DATE_SUB(?, INTERVAL 1 DAY))
         )`,
      [referenceDate, referenceDate]
    );

    if (rows.length === 0) {
      return { actualizados: 0, eventos: [] };
    }

    const ids = rows.map((row) => row.evento_id);

    const [result] = await db.query(
      `UPDATE eventos
       SET estado = 'finalizado', actualizado_en = NOW()
       WHERE evento_id IN (?)`,
      [ids]
    );

    return { actualizados: result.affectedRows ?? 0, eventos: rows };
  },
};

module.exports = EventosModel;
