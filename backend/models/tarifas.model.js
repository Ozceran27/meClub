const db = require('../config/db');

const TarifasModel = {
  listarPorClub: async (club_id, dia_semana = null) => {
    if (dia_semana) {
      const [rows] = await db.query(
        `SELECT tarifa_id, club_id, dia_semana, hora_desde, hora_hasta, precio
         FROM tarifas_club
         WHERE club_id = ? AND dia_semana = ?
         ORDER BY hora_desde ASC`,
        [club_id, dia_semana]
      );
      return rows;
    }
    const [rows] = await db.query(
      `SELECT tarifa_id, club_id, dia_semana, hora_desde, hora_hasta, precio
       FROM tarifas_club
       WHERE club_id = ?
       ORDER BY dia_semana ASC, hora_desde ASC`,
      [club_id]
    );
    return rows;
  },

  upsertItems: async (club_id, items = []) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      for (const it of items) {
        const { dia_semana, hora_desde, hora_hasta, precio } = it || {};
        if (
          !Number.isInteger(dia_semana) || dia_semana < 1 || dia_semana > 7 ||
          !hora_desde || !hora_hasta || !(precio >= 0)
        ) {
          throw new Error('Item de tarifa inválido');
        }

        await conn.query(
          `INSERT INTO tarifas_club (club_id, dia_semana, hora_desde, hora_hasta, precio)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE precio = VALUES(precio)`,
          [club_id, dia_semana, hora_desde, hora_hasta, precio]
        );
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  /**
   * Devuelve la fila de tarifa aplicable si:
   * - mismo club y mismo día
   * - la franja [hora_desde, hora_hasta] cubre completamente [inicio, fin]
   * Si nada aplica, retorna null.
   */
  obtenerTarifaAplicable: async (club_id, dia_semana, inicio, fin) => {
    const [rows] = await db.query(
      `SELECT tarifa_id, precio
       FROM tarifas_club
       WHERE club_id = ?
         AND dia_semana = ?
         AND hora_desde <= ?
         AND hora_hasta >= ?
       ORDER BY hora_desde DESC
       LIMIT 1`,
      [club_id, dia_semana, inicio, fin]
    );
    return rows[0] || null;
  },
};

module.exports = TarifasModel;
