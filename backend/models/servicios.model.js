const db = require('../config/db');

const ServiciosModel = {
  listarDisponibles: async () => {
    const [rows] = await db.query(
      `SELECT servicio_id, slug, nombre, descripcion, icono
       FROM servicios
       ORDER BY nombre ASC`
    );
    return rows;
  },
};

module.exports = ServiciosModel;
