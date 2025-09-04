const db = require('../config/db');

const ReservasModel = {
  existeSolape: async ({ cancha_id, fecha, hora_inicio, hora_fin }) => {
    const [rows] = await db.query(
      `SELECT r.reserva_id
       FROM reservas r
       WHERE r.cancha_id = ?
         AND r.fecha = ?
         AND NOT (r.hora_fin <= ? OR r.hora_inicio >= ?)
       LIMIT 1`,
      [cancha_id, fecha, hora_inicio, hora_fin]
    );
    return rows.length > 0;
  },

  crear: async ({
    usuario_id,
    cancha_id,
    fecha,
    hora_inicio,
    hora_fin,
    duracion_horas = 1,
    monto = null,
    grabacion_solicitada = 0
  }) => {
    if (!usuario_id) throw new Error('usuario_id es requerido');

    const [result] = await db.query(
      `INSERT INTO reservas
       (usuario_id, cancha_id, fecha, hora_inicio, hora_fin, monto, grabacion_solicitada, duracion_horas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario_id, cancha_id, fecha, hora_inicio, hora_fin,
        monto, grabacion_solicitada ? 1 : 0, duracion_horas
      ]
    );

    return {
      reserva_id: result.insertId,
      usuario_id,
      cancha_id,
      fecha,
      hora_inicio,
      hora_fin,
      duracion_horas,
      monto,
      grabacion_solicitada: !!grabacion_solicitada
    };
  },

  misReservas: async (usuario_id) => {
    const [rows] = await db.query(
      `SELECT r.*, c.nombre AS cancha_nombre
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE r.usuario_id = ?
       ORDER BY r.fecha DESC, r.hora_inicio DESC`,
      [usuario_id]
    );
    return rows;
  },

  reservasPorCanchaFecha: async (cancha_id, fecha) => {
    const [rows] = await db.query(
      `SELECT r.reserva_id, r.usuario_id, r.cancha_id, r.fecha, r.hora_inicio, r.hora_fin,
              r.duracion_horas, r.estado, r.monto, r.grabacion_solicitada,
              u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.email AS usuario_email
       FROM reservas r
       JOIN usuarios u ON u.usuario_id = r.usuario_id
       WHERE r.cancha_id = ? AND r.fecha = ?
       ORDER BY r.hora_inicio ASC`,
      [cancha_id, fecha]
    );
    return rows;
  },

  getByIdConClub: async (reserva_id) => {
    const [rows] = await db.query(
      `SELECT r.*, c.club_id
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE r.reserva_id = ?`,
      [reserva_id]
    );
    return rows[0] || null;
  },

  updateEstado: async (reserva_id, nuevoEstado) => {
    await db.query(
      `UPDATE reservas SET estado = ? WHERE reserva_id = ?`,
      [nuevoEstado, reserva_id]
    );
  },
};

module.exports = ReservasModel;
