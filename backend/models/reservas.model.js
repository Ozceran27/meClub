const db = require('../config/db');
const { ESTADOS_RESERVA_ACTIVOS, esEstadoReservaActivo } = require('../constants/reservasEstados');

const RESERVA_SOLAPADA_CODE = 'RESERVA_SOLAPADA';

const ReservasModel = {
  existeSolape: async ({ cancha_id, fecha, hora_inicio, hora_fin }) => {
    const [rows] = await db.query(
      `SELECT r.reserva_id
       FROM reservas r
       WHERE r.cancha_id = ?
         AND r.fecha = ?
         AND NOT (r.hora_fin <= ? OR r.hora_inicio >= ?)
         AND r.estado IN (?)
       LIMIT 1`,
      [cancha_id, fecha, hora_inicio, hora_fin, ESTADOS_RESERVA_ACTIVOS]
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

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [solapadas] = await connection.query(
        `SELECT r.reserva_id
         FROM reservas r
         WHERE r.cancha_id = ?
           AND r.fecha = ?
           AND NOT (r.hora_fin <= ? OR r.hora_inicio >= ?)
           AND r.estado IN (?)
         LIMIT 1
         FOR UPDATE`,
        [cancha_id, fecha, hora_inicio, hora_fin, ESTADOS_RESERVA_ACTIVOS]
      );

      if (solapadas.length > 0) {
        const error = new Error('El horario solicitado se solapa con otra reserva');
        error.code = RESERVA_SOLAPADA_CODE;
        throw error;
      }

      const [result] = await connection.query(
        `INSERT INTO reservas
         (usuario_id, cancha_id, fecha, hora_inicio, hora_fin, monto, grabacion_solicitada, duracion_horas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuario_id, cancha_id, fecha, hora_inicio, hora_fin,
          monto, grabacion_solicitada ? 1 : 0, duracion_horas
        ]
      );

      await connection.commit();

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
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error al revertir la transacción de reserva', rollbackError);
      }

      throw error;
    } finally {
      connection.release();
    }
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
    return esEstadoReservaActivo(nuevoEstado);
  },
};

ReservasModel.RESERVA_SOLAPADA_CODE = RESERVA_SOLAPADA_CODE;

module.exports = ReservasModel;
