const db = require('../config/db');
const { normalizeCourtImage } = require('../utils/courtImage');

const toNullableInteger = (value) => {
  if (value === undefined || value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveLimiteEquipos = (row) => {
  if (!row) return null;
  return toNullableInteger(row.limite_equipos ?? row.cantidad_equipos);
};

const normalizeTipoEvento = (tipo) => {
  if (!tipo) return tipo;
  const normalized = String(tipo).trim().toLowerCase();
  if (normalized === 'liga') return 'torneo';
  return normalized;
};

const normalizeEventoRow = (row) => {
  if (!row) return null;
  const horaFin = row.hora_fin ?? row.hora_finalizacion ?? null;
  return {
    ...row,
    evento_id: toNullableInteger(row.evento_id),
    club_id: toNullableInteger(row.club_id),
    provincia_id: toNullableInteger(row.provincia_id),
    deporte_id: toNullableInteger(row.deporte_id),
    tipo: normalizeTipoEvento(row.tipo),
    limite_equipos: resolveLimiteEquipos(row),
    hora_fin: horaFin,
    imagen_url: normalizeCourtImage(row.imagen_url),
  };
};

let limiteColumnCache = null;
let limiteColumnPromise = null;

const resolveLimiteColumn = async () => {
  if (limiteColumnCache) return limiteColumnCache;
  if (limiteColumnPromise) return limiteColumnPromise;

  limiteColumnPromise = (async () => {
    const [limiteRows] = await db.query("SHOW COLUMNS FROM eventos LIKE 'limite_equipos'");
    if (limiteRows.length > 0) {
      limiteColumnCache = 'limite_equipos';
      return limiteColumnCache;
    }
    const [cantidadRows] = await db.query("SHOW COLUMNS FROM eventos LIKE 'cantidad_equipos'");
    if (cantidadRows.length > 0) {
      limiteColumnCache = 'cantidad_equipos';
      return limiteColumnCache;
    }
    limiteColumnCache = null;
    return limiteColumnCache;
  })();

  try {
    return await limiteColumnPromise;
  } finally {
    limiteColumnPromise = null;
  }
};

let horaFinColumnCache = null;
let horaFinColumnPromise = null;

const resolveHoraFinColumn = async () => {
  if (horaFinColumnCache !== null) return horaFinColumnCache;
  if (horaFinColumnPromise) return horaFinColumnPromise;

  horaFinColumnPromise = (async () => {
    const [horaFinRows] = await db.query("SHOW COLUMNS FROM eventos LIKE 'hora_fin'");
    if (horaFinRows.length > 0) {
      horaFinColumnCache = 'hora_fin';
      return horaFinColumnCache;
    }
    const [horaFinalizacionRows] = await db.query(
      "SHOW COLUMNS FROM eventos LIKE 'hora_finalizacion'"
    );
    if (horaFinalizacionRows.length > 0) {
      horaFinColumnCache = 'hora_finalizacion';
      return horaFinColumnCache;
    }
    horaFinColumnCache = null;
    return horaFinColumnCache;
  })();

  try {
    return await horaFinColumnPromise;
  } finally {
    horaFinColumnPromise = null;
  }
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
      `SELECT eventos.*
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
      `SELECT eventos.*,
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
      `SELECT eventos.*
       FROM eventos
       WHERE evento_id = ? AND club_id = ?
       LIMIT 1`,
      [eventoId, clubId]
    );
    return normalizeEventoRow(rows[0]);
  },

  obtenerGlobalPorId: async (eventoId) => {
    const [rows] = await db.query(
      `SELECT eventos.*,
              clubes.nombre AS club_nombre
       FROM eventos
       LEFT JOIN clubes ON clubes.club_id = eventos.club_id
       WHERE eventos.evento_id = ?
       LIMIT 1`,
      [eventoId]
    );
    return normalizeEventoRow(rows[0]);
  },

  crear: async (clubId, payload) => {
    const cantidadEquipos =
      payload.cantidad_equipos ?? payload.limite_equipos ?? null;
    const limiteColumn = (await resolveLimiteColumn()) || 'cantidad_equipos';
    const horaFinColumn = (await resolveHoraFinColumn()) || 'hora_fin';
    const [result] = await db.query(
      `INSERT INTO eventos
       (club_id, nombre, tipo, descripcion, estado, fecha_inicio, fecha_fin, hora_inicio, ${horaFinColumn},
        provincia_id, zona, deporte_id, ${limiteColumn}, valor_inscripcion, premio_1, premio_2,
        premio_3, imagen_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clubId,
        payload.nombre,
        payload.tipo,
        payload.descripcion,
        payload.estado,
        payload.fecha_inicio,
        payload.fecha_fin,
        payload.hora_inicio,
        payload.hora_fin,
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
      const limiteColumn = (await resolveLimiteColumn()) || 'cantidad_equipos';
      if (limiteColumn === 'limite_equipos') {
        normalizedUpdates.limite_equipos = normalizedUpdates.limite_equipos;
      } else {
        normalizedUpdates[limiteColumn] = normalizedUpdates.limite_equipos;
        delete normalizedUpdates.limite_equipos;
      }
    }
    if (normalizedUpdates.hora_fin !== undefined) {
      const horaFinColumn = (await resolveHoraFinColumn()) || 'hora_fin';
      if (horaFinColumn !== 'hora_fin') {
        normalizedUpdates[horaFinColumn] = normalizedUpdates.hora_fin;
        delete normalizedUpdates.hora_fin;
      }
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

  guardarImagen: async (eventoId, file) => {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new Error('Archivo de imagen inválido');
    }

    await db.query(`UPDATE eventos SET imagen_url = ? WHERE evento_id = ?`, [
      file.buffer,
      eventoId,
    ]);
    return normalizeCourtImage(file.buffer);
  },

  actualizarImagen: async (eventoId, clubId, file) => {
    const existente = await EventosModel.obtenerPorId(eventoId, clubId);
    if (!existente) {
      throw new Error('Evento no encontrado');
    }

    return EventosModel.guardarImagen(eventoId, file);
  },

  finalizarEventosVencidos: async (referenceDate = new Date()) => {
    const horaFinColumn = await resolveHoraFinColumn();
    const torneoHoraCondition = horaFinColumn
      ? `AND ${horaFinColumn} IS NOT NULL
             AND TIMESTAMP(fecha_fin, ${horaFinColumn}) <= ?`
      : 'AND fecha_fin <= DATE(?)';
    const [rows] = await db.query(
      `SELECT evento_id, club_id
       FROM eventos
       WHERE estado <> 'finalizado'
         AND (
           (tipo = 'amistoso'
             AND fecha_inicio IS NOT NULL
             AND hora_inicio IS NOT NULL
             AND TIMESTAMP(fecha_inicio, hora_inicio) <= ?)
           OR
           (tipo IN ('torneo', 'copa')
             AND fecha_fin IS NOT NULL
             ${torneoHoraCondition})
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
