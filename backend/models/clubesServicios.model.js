const db = require('../config/db');

const ClubesServiciosModel = {
  listarSeleccionados: async (clubId) => {
    const [rows] = await db.query(
      `SELECT cs.servicio_id, s.slug, s.nombre, s.descripcion, s.icono
       FROM clubes_servicios cs
       JOIN servicios s ON s.servicio_id = cs.servicio_id
       WHERE cs.club_id = ? AND cs.activo = 1
       ORDER BY s.nombre ASC`,
      [clubId]
    );

    return rows;
  },

  reemplazarSeleccion: async (clubId, servicioIds = []) => {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query('UPDATE clubes_servicios SET activo = 0 WHERE club_id = ?', [clubId]);

      for (const servicioId of servicioIds) {
        await connection.query(
          `INSERT INTO clubes_servicios (club_id, servicio_id, activo)
           VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE activo = VALUES(activo)`,
          [clubId, servicioId]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return ClubesServiciosModel.listarSeleccionados(clubId);
  },
};

module.exports = ClubesServiciosModel;
