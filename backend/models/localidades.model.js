const db = require('../config/db');

const LOCALIDADES_TABLES = ['localidades', 'localidad'];
const ID_COLUMNS = ['localidad_id', 'id'];
const POSTAL_COLUMNS = ['codigo_postal', 'codigopostal', null];
let clubesLocalidadRefCache = null;
let clubesLocalidadRefChecked = false;

const shouldRetrySchemaError = (err) =>
  err &&
  (err.code === 'ER_BAD_FIELD_ERROR' ||
    err.code === 'ER_NO_SUCH_TABLE' ||
    /Unknown column|doesn't exist/i.test(err.message || ''));

const getClubesLocalidadReference = async () => {
  if (clubesLocalidadRefChecked) return clubesLocalidadRefCache;
  clubesLocalidadRefChecked = true;

  try {
    const [rows] = await db.query(
      `SELECT REFERENCED_TABLE_NAME AS table_name, REFERENCED_COLUMN_NAME AS column_name
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'clubes'
         AND COLUMN_NAME = 'localidad_id'
         AND REFERENCED_TABLE_NAME IS NOT NULL
       LIMIT 1`
    );
    const row = rows?.[0];
    if (row?.table_name && row?.column_name) {
      clubesLocalidadRefCache = {
        table: row.table_name,
        column: row.column_name,
      };
    }
  } catch (err) {
    if (!shouldRetrySchemaError(err)) {
      console.error('Error obteniendo referencia de localidades para clubes', err);
    }
  }

  return clubesLocalidadRefCache;
};

const LocalidadesModel = {
  listarPorProvincia: async (provinciaId, search = null) => {
    const provinciaNumeric = Number(provinciaId);
    if (!Number.isInteger(provinciaNumeric)) {
      throw new Error('provinciaId inválido');
    }

    const valuesBase = [provinciaNumeric];
    let lastError;

    for (const table of LOCALIDADES_TABLES) {
      for (const idColumn of ID_COLUMNS) {
        for (const postalColumn of POSTAL_COLUMNS) {
          for (const includeActivo of [true, false]) {
            const idSelect = idColumn === 'id' ? 'id' : 'localidad_id';
            const postalSelect = postalColumn
              ? `${postalColumn} AS codigo_postal`
              : 'NULL AS codigo_postal';
            let sql = `
              SELECT ${idSelect} AS localidad_id,
                ${idSelect} AS id,
                provincia_id,
                nombre,
                ${postalSelect}
              FROM ${table}
              WHERE provincia_id = ?
            `;

            const values = [...valuesBase];

            if (includeActivo) {
              sql += ' AND activo = 1';
            }

            if (search && typeof search === 'string') {
              sql += ' AND nombre LIKE ?';
              values.push(`%${search}%`);
            }

            sql += ' ORDER BY nombre ASC';

            try {
              const [rows] = await db.query(sql, values);
              return rows;
            } catch (err) {
              lastError = err;
              if (!shouldRetrySchemaError(err)) {
                throw err;
              }
            }
          }
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    return [];
  },

  existe: async (localidadId) => {
    const localidadNumeric = Number(localidadId);
    if (!Number.isInteger(localidadNumeric)) {
      return false;
    }

    let lastError;
    const clubesReference = await getClubesLocalidadReference();
    if (clubesReference?.table && clubesReference?.column) {
      try {
        const [rows] = await db.query(
          `SELECT 1 FROM ${clubesReference.table} WHERE ${clubesReference.column} = ? LIMIT 1`,
          [localidadNumeric]
        );
        return rows.length > 0;
      } catch (err) {
        lastError = err;
        if (!shouldRetrySchemaError(err)) {
          throw err;
        }
      }
    }

    for (const table of LOCALIDADES_TABLES) {
      for (const idColumn of ID_COLUMNS) {
        const column = idColumn === 'id' ? 'id' : 'localidad_id';
        try {
          const [rows] = await db.query(
            `SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT 1`,
            [localidadNumeric]
          );
          return rows.length > 0;
        } catch (err) {
          lastError = err;
          if (!shouldRetrySchemaError(err)) {
            throw err;
          }
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    return false;
  },

  perteneceAProvincia: async (localidadId, provinciaId) => {
    const localidadNumeric = Number(localidadId);
    const provinciaNumeric = Number(provinciaId);

    if (!Number.isInteger(localidadNumeric) || !Number.isInteger(provinciaNumeric)) {
      return false;
    }

    let lastError;
    const clubesReference = await getClubesLocalidadReference();
    if (clubesReference?.table && clubesReference?.column) {
      try {
        const [rows] = await db.query(
          `SELECT 1
           FROM ${clubesReference.table}
           WHERE ${clubesReference.column} = ? AND provincia_id = ?
           LIMIT 1`,
          [localidadNumeric, provinciaNumeric]
        );
        return rows.length > 0;
      } catch (err) {
        lastError = err;
        if (!shouldRetrySchemaError(err)) {
          throw err;
        }
      }
    }

    for (const table of LOCALIDADES_TABLES) {
      for (const idColumn of ID_COLUMNS) {
        for (const includeActivo of [true, false]) {
          const column = idColumn === 'id' ? 'id' : 'localidad_id';
          let sql = `SELECT 1
             FROM ${table}
             WHERE ${column} = ? AND provincia_id = ?`;
          const values = [localidadNumeric, provinciaNumeric];

          if (includeActivo) {
            sql += ' AND activo = 1';
          }

          sql += ' LIMIT 1';

          try {
            const [rows] = await db.query(sql, values);
            return rows.length > 0;
          } catch (err) {
            lastError = err;
            if (!shouldRetrySchemaError(err)) {
              throw err;
            }
          }
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    return false;
  },
};

module.exports = LocalidadesModel;
