const db = require('../config/db');
const logger = require('./logger');

const REQUIRED_TABLES = ['asociados', 'tipos_asociado'];
const IMPORT_HINT = 'Importar db/dump-meclub-202512292347.txt';

let missingTables = null;
let lastCheckError = null;

const checkTable = async (tableName) => {
  const [rows] = await db.query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
};

const initAsociadosTablesCheck = async () => {
  try {
    const results = await Promise.all(
      REQUIRED_TABLES.map(async (tableName) => ({
        tableName,
        exists: await checkTable(tableName),
      }))
    );
    missingTables = results.filter((item) => !item.exists).map((item) => item.tableName);
    lastCheckError = null;

    if (missingTables.length > 0) {
      logger.error(
        `Faltan tablas requeridas para asociados: ${missingTables.join(', ')}. ${IMPORT_HINT}.`
      );
    } else {
      logger.info('Verificacion de tablas de asociados completa.');
    }
  } catch (error) {
    lastCheckError = error;
    logger.error('No se pudo verificar tablas de asociados al inicio. Se omite bloqueo.', error);
  }
};

const asociadosTablesGuard = (req, res, next) => {
  if (Array.isArray(missingTables) && missingTables.length > 0) {
    return res.status(503).json({
      error: `Faltan tablas requeridas: ${missingTables.join(', ')}`,
      hint: IMPORT_HINT,
    });
  }

  if (lastCheckError) {
    logger.warn('Verificacion de tablas de asociados pendiente por error previo.', lastCheckError);
  }

  return next();
};

module.exports = {
  initAsociadosTablesCheck,
  asociadosTablesGuard,
};
