const db = require('../config/db');

const NivelesModel = {
  listar: async () => {
    const [rows] = await db.query(
      'SELECT nivel_id, nombre, descripcion, camaras_max, precio FROM niveles ORDER BY nivel_id ASC'
    );
    return rows;
  },
  existe: async (nivel_id) => {
    const [rows] = await db.query('SELECT 1 FROM niveles WHERE nivel_id = ? LIMIT 1', [nivel_id]);
    return rows.length > 0;
  }
};

module.exports = NivelesModel;
