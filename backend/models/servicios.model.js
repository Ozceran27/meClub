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

  listarPorIds: async (ids = []) => {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const [rows] = await db.query(
      `SELECT servicio_id, slug, nombre, descripcion, icono
       FROM servicios
       WHERE servicio_id IN (?)
       ORDER BY nombre ASC`,
      [ids]
    );
    return rows;
  },
};

module.exports = ServiciosModel;
