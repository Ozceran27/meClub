const db = require('../config/db');

const normalizeEventoRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    limite_equipos: row.limite_equipos === null ? null : Number(row.limite_equipos),
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
              provincia_id, zona, limite_equipos, creado_en, actualizado_en
       FROM eventos
       WHERE ${filters.join(' AND ')}
       ORDER BY creado_en DESC, evento_id DESC`,
      values
    );
    return rows.map((row) => normalizeEventoRow(row));
  },
  listarGlobales: async ({ provinciaId } = {}) => {
    const values = [];
    let whereClause = "zona = 'nacional'";
    if (provinciaId !== undefined && provinciaId !== null) {
      whereClause = "(zona = 'nacional' OR (zona = 'regional' AND provincia_id = ?))";
      values.push(provinciaId);
    }

    const [rows] = await db.query(
      `SELECT evento_id, club_id, nombre, tipo, descripcion, estado, fecha_inicio, fecha_fin,
              provincia_id, zona, limite_equipos, creado_en, actualizado_en
       FROM eventos
       WHERE ${whereClause}
       ORDER BY creado_en DESC, evento_id DESC`,
      values
    );
    return rows.map((row) => normalizeEventoRow(row));
  },

  obtenerPorId: async (eventoId, clubId) => {
    const [rows] = await db.query(
      `SELECT evento_id, club_id, nombre, tipo, descripcion, estado, fecha_inicio, fecha_fin,
              provincia_id, zona, limite_equipos, creado_en, actualizado_en
       FROM eventos
       WHERE evento_id = ? AND club_id = ?
       LIMIT 1`,
      [eventoId, clubId]
    );
    return normalizeEventoRow(rows[0]);
  },

  crear: async (clubId, payload) => {
    const [result] = await db.query(
      `INSERT INTO eventos
       (club_id, nombre, tipo, descripcion, estado, fecha_inicio, fecha_fin, provincia_id, zona, limite_equipos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clubId,
        payload.nombre,
        payload.tipo,
        payload.descripcion,
        payload.estado,
        payload.fecha_inicio,
        payload.fecha_fin,
        payload.provincia_id,
        payload.zona,
        payload.limite_equipos,
      ]
    );
    return EventosModel.obtenerPorId(result.insertId, clubId);
  },

  actualizar: async (eventoId, clubId, updates) => {
    const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
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

  finalizarEventosVencidos: async () => {
    const [rows] = await db.query(
      `SELECT evento_id, club_id
       FROM eventos
       WHERE fecha_fin IS NOT NULL
         AND fecha_fin < NOW()
         AND estado <> 'finalizado'`
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
