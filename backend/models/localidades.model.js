const db = require('../config/db');

const LocalidadesModel = {
  listarPorProvincia: async (provinciaId, search = null) => {
    const provinciaNumeric = Number(provinciaId);
    if (!Number.isInteger(provinciaNumeric)) {
      throw new Error('provinciaId inválido');
    }

    let sql = `
      SELECT localidad_id, provincia_id, nombre, codigo_postal
      FROM localidades
      WHERE provincia_id = ? AND activo = 1
    `;

    const values = [provinciaNumeric];

    if (search && typeof search === 'string') {
      sql += ' AND nombre LIKE ?';
      values.push(`%${search}%`);
    }

    sql += ' ORDER BY nombre ASC';

    const [rows] = await db.query(sql, values);
    return rows;
  },

  existe: async (localidadId) => {
    const localidadNumeric = Number(localidadId);
    if (!Number.isInteger(localidadNumeric)) {
      return false;
    }

    const [rows] = await db.query(
      'SELECT 1 FROM localidades WHERE localidad_id = ? LIMIT 1',
      [localidadNumeric]
    );

    return rows.length > 0;
  },

  perteneceAProvincia: async (localidadId, provinciaId) => {
    const localidadNumeric = Number(localidadId);
    const provinciaNumeric = Number(provinciaId);

    if (!Number.isInteger(localidadNumeric) || !Number.isInteger(provinciaNumeric)) {
      return false;
    }

    const [rows] = await db.query(
      `SELECT 1
       FROM localidades
       WHERE localidad_id = ? AND provincia_id = ? AND activo = 1
       LIMIT 1`,
      [localidadNumeric, provinciaNumeric]
    );

    return rows.length > 0;
  },
};

module.exports = LocalidadesModel;
