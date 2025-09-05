const assert = require('assert');
const path = require('path');

// Mock database module before requiring the model
const dbPath = path.resolve(__dirname, '../config/db');
require.cache[require.resolve(dbPath)] = {
  exports: {
    query: async (sql) => {
      if (sql.includes('FROM canchas')) return [[{ total: 2 }]];
      if (sql.includes('r.fecha = CURDATE()')) return [[{ total: 3 }]];
      if (sql.includes('YEARWEEK')) return [[{ total: 4 }]];
      if (sql.includes('COALESCE(SUM')) return [[{ total: 100 }]];
      return [[{ total: 0 }]];
    },
  },
};

const ClubesModel = require('../models/clubes.model');

(async () => {
  const resumen = await ClubesModel.obtenerResumen(1);
  assert.strictEqual(resumen.reservasSemana, 4);
  console.log('obtenerResumen:', resumen);
})();

