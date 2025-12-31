const db = require('../config/db');

const parseDiasDisponibles = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return value
      .split(',')
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item));
  }
};

const normalizeRow = (row) => ({
  ...row,
  dias_disponibles: parseDiasDisponibles(row.dias_disponibles),
  precio_valor: row.precio_valor === null ? null : Number(row.precio_valor),
  no_fumar: Boolean(row.no_fumar),
  mas_18: Boolean(row.mas_18),
  comida: Boolean(row.comida),
  eco_friendly: Boolean(row.eco_friendly),
  activo: Boolean(row.activo),
});

let hasServicioCatalogoIdColumn;

const ensureServicioCatalogoIdColumn = async () => {
  if (hasServicioCatalogoIdColumn !== undefined) {
    return hasServicioCatalogoIdColumn;
  }

  const [rows] = await db.query(
    "SHOW COLUMNS FROM club_servicios LIKE 'servicio_catalogo_id'"
  );
  hasServicioCatalogoIdColumn = rows.length > 0;
  return hasServicioCatalogoIdColumn;
};

const buildSelectColumns = async () => {
  const hasColumn = await ensureServicioCatalogoIdColumn();
  const servicioCatalogoColumn = hasColumn
    ? 'servicio_catalogo_id'
    : 'NULL AS servicio_catalogo_id';
  return `servicio_id, ${servicioCatalogoColumn}, club_id, nombre, modo_acceso, dias_disponibles, hora_inicio, hora_fin,
          imagen_url, color, ambiente, precio_tipo, precio_valor, no_fumar, mas_18, comida, eco_friendly,
          activo, creado_en, actualizado_en`;
};

const ClubServiciosModel = {
  listarPorClub: async (clubId) => {
    const columns = await buildSelectColumns();
    const [rows] = await db.query(
      `SELECT ${columns}
       FROM club_servicios
       WHERE club_id = ?
       ORDER BY creado_en DESC, servicio_id DESC`,
      [clubId]
    );

    return rows.map((row) => normalizeRow(row));
  },

  obtenerPorId: async (servicioId, clubId) => {
    const columns = await buildSelectColumns();
    const [rows] = await db.query(
      `SELECT ${columns}
       FROM club_servicios
       WHERE servicio_id = ? AND club_id = ?
       LIMIT 1`,
      [servicioId, clubId]
    );

    const row = rows[0];
    return row ? normalizeRow(row) : null;
  },

  crear: async (clubId, payload) => {
    try {
      const hasColumn = await ensureServicioCatalogoIdColumn();
      const columns = [
        'club_id',
        ...(hasColumn ? ['servicio_catalogo_id'] : []),
        'nombre',
        'modo_acceso',
        'dias_disponibles',
        'hora_inicio',
        'hora_fin',
        'imagen_url',
        'color',
        'ambiente',
        'precio_tipo',
        'precio_valor',
        'no_fumar',
        'mas_18',
        'comida',
        'eco_friendly',
        'activo',
      ];
      const values = [
        clubId,
        ...(hasColumn ? [payload.servicio_catalogo_id ?? null] : []),
        payload.nombre,
        payload.modo_acceso,
        payload.dias_disponibles,
        payload.hora_inicio,
        payload.hora_fin,
        payload.imagen_url,
        payload.color ?? null,
        payload.ambiente,
        payload.precio_tipo,
        payload.precio_valor,
        payload.no_fumar ? 1 : 0,
        payload.mas_18 ? 1 : 0,
        payload.comida ? 1 : 0,
        payload.eco_friendly ? 1 : 0,
        payload.activo ? 1 : 0,
      ];
      const placeholders = columns.map(() => '?').join(', ');

      const [result] = await db.query(
        `INSERT INTO club_servicios (${columns.join(', ')})
         VALUES (${placeholders})`,
        values
      );

      return ClubServiciosModel.obtenerPorId(result.insertId, clubId);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        const error = new Error('Ya existe un servicio con ese nombre para este club');
        error.statusCode = 400;
        throw error;
      }
      throw err;
    }
  },

  crearDesdeCatalogo: async (clubId, catalogoRows = []) => {
    if (!Array.isArray(catalogoRows) || catalogoRows.length === 0) {
      return [];
    }

    const hasColumn = await ensureServicioCatalogoIdColumn();
    if (hasColumn) {
      const values = catalogoRows.map((row) => [
        clubId,
        row.servicio_id,
        row.nombre,
        1,
      ]);

      await db.query(
        `INSERT INTO club_servicios (club_id, servicio_catalogo_id, nombre, activo)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           servicio_catalogo_id = VALUES(servicio_catalogo_id),
           nombre = VALUES(nombre),
           activo = VALUES(activo)`,
        [values]
      );
    } else {
      const values = catalogoRows.map((row) => [
        clubId,
        row.nombre,
        1,
      ]);

      await db.query(
        `INSERT INTO club_servicios (club_id, nombre, activo)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           nombre = VALUES(nombre),
           activo = VALUES(activo)`,
        [values]
      );
    }

    return ClubServiciosModel.listarPorClub(clubId);
  },

  eliminarNoSeleccionados: async (clubId, catalogoIds = []) => {
    const hasColumn = await ensureServicioCatalogoIdColumn();
    if (!hasColumn) {
      return 0;
    }

    if (!Array.isArray(catalogoIds) || catalogoIds.length === 0) {
      const [result] = await db.query(
        'DELETE FROM club_servicios WHERE club_id = ? AND servicio_catalogo_id IS NOT NULL',
        [clubId]
      );
      return result.affectedRows;
    }

    const [result] = await db.query(
      `DELETE FROM club_servicios
       WHERE club_id = ?
         AND servicio_catalogo_id IS NOT NULL
         AND servicio_catalogo_id NOT IN (?)`,
      [clubId, catalogoIds]
    );

    return result.affectedRows;
  },

  actualizar: async (servicioId, clubId, updates) => {
    const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (fields.length === 0) {
      return ClubServiciosModel.obtenerPorId(servicioId, clubId);
    }

    const setters = [];
    const values = [];
    fields.forEach(([key, value]) => {
      setters.push(`${key} = ?`);
      if (['no_fumar', 'mas_18', 'comida', 'eco_friendly', 'activo'].includes(key)) {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    });

    values.push(servicioId, clubId);

    await db.query(
      `UPDATE club_servicios
       SET ${setters.join(', ')}
       WHERE servicio_id = ? AND club_id = ?`,
      values
    );

    return ClubServiciosModel.obtenerPorId(servicioId, clubId);
  },

  eliminar: async (servicioId, clubId) => {
    const [result] = await db.query(
      'DELETE FROM club_servicios WHERE servicio_id = ? AND club_id = ?',
      [servicioId, clubId]
    );

    return result.affectedRows > 0;
  },

  reemplazarSeleccion: async (clubId, servicioIds = []) => {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query('UPDATE club_servicios SET activo = 0 WHERE club_id = ?', [clubId]);

      if (servicioIds.length) {
        await connection.query(
          'UPDATE club_servicios SET activo = 1 WHERE club_id = ? AND servicio_id IN (?)',
          [clubId, servicioIds]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return ClubServiciosModel.listarPorClub(clubId);
  },

  contarPorClub: async (clubId) => {
    const [rows] = await db.query(
      'SELECT COUNT(*) as total FROM club_servicios WHERE club_id = ?',
      [clubId]
    );
    return Number(rows?.[0]?.total ?? 0);
  },
};

module.exports = ClubServiciosModel;
