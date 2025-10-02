const db = require('../config/db');

const ClubesImpuestosModel = {
  listarSeleccionados: async (clubId) => {
    const [rows] = await db.query(
      `SELECT impuesto_id, nombre, porcentaje, descripcion
       FROM clubes_impuestos
       WHERE club_id = ? AND activo = 1
       ORDER BY nombre ASC`,
      [clubId]
    );

    return rows.map((row) => ({
      ...row,
      porcentaje: row.porcentaje === null ? null : Number(row.porcentaje),
      descripcion: row.descripcion || null,
    }));
  },

  reemplazarSeleccion: async (clubId, items = []) => {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query('UPDATE clubes_impuestos SET activo = 0 WHERE club_id = ?', [clubId]);

      for (const item of items) {
        const { nombre, porcentaje, descripcion = null } = item;
        await connection.query(
          `INSERT INTO clubes_impuestos (club_id, nombre, porcentaje, descripcion, activo)
           VALUES (?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE porcentaje = VALUES(porcentaje), descripcion = VALUES(descripcion), activo = VALUES(activo)`,
          [clubId, nombre, porcentaje, descripcion]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return ClubesImpuestosModel.listarSeleccionados(clubId);
  },
};

module.exports = ClubesImpuestosModel;
