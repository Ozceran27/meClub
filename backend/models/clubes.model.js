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

};

module.exports = ClubesModel;
