const db = require('../config/db');

const EquiposModel = {
  buscarPorNombre: async ({ term, limit = 10, clubId = null }) => {
    const numericLimit = Number.parseInt(limit, 10);
    const sanitizedLimit = Number.isInteger(numericLimit) && numericLimit > 0 ? numericLimit : 10;
    const likeTerm = `%${term}%`;
    const params = [likeTerm];
    let query = `SELECT equipo_id, nombre, descripcion, club_id
                 FROM equipos_usuarios
                 WHERE activo = 1
                   AND nombre LIKE ?`;

    if (clubId) {
      query += ' AND club_id = ?';
      params.push(clubId);
    }

    query += ' ORDER BY nombre ASC LIMIT ?';
    params.push(sanitizedLimit);

    const [rows] = await db.query(query, params);
    return rows;
  },
};

module.exports = EquiposModel;
