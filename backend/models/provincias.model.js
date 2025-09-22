const db = require('../config/db');

const ProvinciasModel = {
  listar: async () => {
    const [rows] = await db.query('SELECT id, nombre FROM provincia ORDER BY nombre');
    return rows;
  },

  existe: async (id) => {
    const [rows] = await db.query('SELECT 1 FROM provincia WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0;
  },
};

module.exports = ProvinciasModel;
