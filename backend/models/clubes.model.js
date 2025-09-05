const db = require('../config/db');

const ClubesModel = {
  crearClub: async ({
    nombre,
    descripcion,
    usuario_id,
    nivel_id = 1,
    foto_logo = null,
    foto_portada = null,
    provincia_id = null,
    localidad_id = null,
  }) => {
    const [result] = await db.query(
      `INSERT INTO clubes
       (nombre, descripcion, usuario_id, nivel_id, foto_logo, foto_portada, provincia_id, localidad_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, descripcion || null, usuario_id, nivel_id, foto_logo, foto_portada, provincia_id, localidad_id]
    );

    return {
      club_id: result.insertId,
      nombre,
      descripcion: descripcion || null,
      usuario_id,
      nivel_id,
      foto_logo,
      foto_portada,
      provincia_id,
      localidad_id,
    };
  },

  obtenerClubPorPropietario: async (usuario_id) => {
    const [rows] = await db.query('SELECT * FROM clubes WHERE usuario_id = ? LIMIT 1', [usuario_id]);
    return rows[0] || null;
  },

  obtenerMisCanchas: async (club_id) => {
    const [rows] = await db.query(
      'SELECT * FROM canchas WHERE club_id = ? ORDER BY cancha_id DESC',
      [club_id]
    );
    return rows;
  },

  obtenerClubPorId: async (club_id) => {
    const [rows] = await db.query(`SELECT * FROM clubes WHERE club_id = ?`, [club_id]);
    return rows[0] || null;
  },

  obtenerResumen: async (club_id) => {
    const [[{ total: courtsAvailable = 0 } = {}]] = await db.query(
      'SELECT COUNT(*) AS total FROM canchas WHERE club_id = ?',
      [club_id]
    );

    const [[{ total: reservasHoy = 0 } = {}]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ? AND r.fecha = CURDATE()`,
      [club_id]
    );

    const [[{ total: reservasSemana = 0 } = {}]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND YEARWEEK(r.fecha, 1) = YEARWEEK(CURDATE(), 1)`,
      [club_id]
    );

    const [[{ total: economiaMes = 0 } = {}]] = await db.query(
      `SELECT COALESCE(SUM(r.monto), 0) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND DATE_FORMAT(r.fecha, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
      [club_id]
    );

    return { courtsAvailable, reservasHoy, reservasSemana, economiaMes };
  },

};

module.exports = ClubesModel;
