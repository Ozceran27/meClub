const db = require('../config/db');

const DeportesModel = {
  listar: async () => {
    const [rows] = await db.query(
      'SELECT deporte_id, nombre, descripcion FROM deportes ORDER BY nombre ASC'
    );
    return rows;
  },
};

module.exports = DeportesModel;
