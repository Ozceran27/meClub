const db = require('../config/db');

const CanchasModel = {
  crearCancha: async ({ club_id, nombre, deporte_id, capacidad, precio, techada = 0, iluminacion = 0 }) => {
    const [result] = await db.query(
      `INSERT INTO canchas (club_id, nombre, deporte_id, capacidad, precio, techada, iluminacion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [club_id, nombre, deporte_id, capacidad, precio, techada ? 1 : 0, iluminacion ? 1 : 0]
    );
    return {
      cancha_id: result.insertId,
      club_id, nombre, deporte_id, capacidad, precio,
      techada: !!techada, iluminacion: !!iluminacion
    };
  },

  obtenerCanchaPorId: async (cancha_id) => {
    const [rows] = await db.query(`SELECT * FROM canchas WHERE cancha_id = ?`, [cancha_id]);
    return rows[0] || null;
  },

  perteneceAClub: async (cancha_id, club_id) => {
    const [rows] = await db.query(
      `SELECT 1 FROM canchas WHERE cancha_id = ? AND club_id = ? LIMIT 1`,
      [cancha_id, club_id]
    );
    return rows.length > 0;
  },

  listarPorClub: async (club_id) => {
    const [rows] = await db.query(
      `SELECT cancha_id, nombre, deporte_id, capacidad, precio, techada, iluminacion
       FROM canchas
       WHERE club_id = ?
       ORDER BY cancha_id DESC`,
      [club_id]
    );
    return rows;
  },
};

module.exports = CanchasModel;

