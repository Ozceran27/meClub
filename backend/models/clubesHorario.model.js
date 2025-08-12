const db = require('../config/db');

const ClubesHorarioModel = {
  listarPorClub: async (club_id) => {
    const [rows] = await db.query(
      `SELECT club_horario_id, dia_semana, abre, cierra, activo
       FROM clubes_horario
       WHERE club_id = ?
       ORDER BY dia_semana ASC`,
      [club_id]
    );
    return rows;
  },

  // Nuevo: obtener horario de un día puntual
  getPorClubYDia: async (club_id, dia_semana) => {
    const [rows] = await db.query(
      `SELECT club_horario_id, dia_semana, abre, cierra, activo
       FROM clubes_horario
       WHERE club_id = ? AND dia_semana = ?
       LIMIT 1`,
      [club_id, dia_semana]
    );
    return rows[0] || null;
  },

  // upsert para un día
  upsertDia: async ({ club_id, dia_semana, abre, cierra, activo = 1 }) => {
    await db.query(
      `INSERT INTO clubes_horario (club_id, dia_semana, abre, cierra, activo)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE abre=VALUES(abre), cierra=VALUES(cierra), activo=VALUES(activo)`,
      [club_id, dia_semana, abre, cierra, activo ? 1 : 0]
    );
  }
};

module.exports = ClubesHorarioModel;

