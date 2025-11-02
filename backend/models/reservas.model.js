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
    usuario_id = null,
    creado_por_id,
    cancha_id,
    fecha,
    hora_inicio,
    hora_fin,
    duracion_horas = 1,
    monto = null,
    monto_base = null,
    monto_grabacion = null,
    tipo_reserva = 'relacionada',
    contacto_nombre = null,
    contacto_apellido = null,
    contacto_telefono = null,
    grabacion_solicitada = 0,
  }) => {
    if (!creado_por_id) throw new Error('creado_por_id es requerido');
    if (!cancha_id) throw new Error('cancha_id es requerido');
    if (!fecha) throw new Error('fecha es requerida');
    if (!hora_inicio) throw new Error('hora_inicio es requerida');

    const tipoReservaNormalizado = tipo_reserva === 'privada' ? 'privada' : 'relacionada';

    const sanitizeContacto = (value, maxLength) => {
      if (value === undefined || value === null) return null;
      const trimmed = String(value).trim();
      if (!trimmed) return null;
      return trimmed.slice(0, maxLength);
    };

    const contactoNombreValue = sanitizeContacto(contacto_nombre, 100);
    const contactoApellidoValue = sanitizeContacto(contacto_apellido, 100);
    const contactoTelefonoValue = sanitizeContacto(contacto_telefono, 25);

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
         (usuario_id, cancha_id, fecha, hora_inicio, hora_fin, monto, grabacion_solicitada, duracion_horas,
          tipo_reserva, contacto_nombre, contacto_apellido, contacto_telefono, creado_por_id,
          monto_base, monto_grabacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuario_id,
          cancha_id,
          fecha,
          hora_inicio,
          hora_fin,
          monto,
          grabacion_solicitada ? 1 : 0,
          duracion_horas,
          tipoReservaNormalizado,
          contactoNombreValue,
          contactoApellidoValue,
          contactoTelefonoValue,
          creado_por_id,
          monto_base,
          monto_grabacion,
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
        creado_por_id,
        duracion_horas,
        monto,
        monto_base,
        monto_grabacion,
        grabacion_solicitada: !!grabacion_solicitada,
        tipo_reserva: tipoReservaNormalizado,
        contacto_nombre: contactoNombreValue,
        contacto_apellido: contactoApellidoValue,
        contacto_telefono: contactoTelefonoValue,
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
              r.tipo_reserva, r.contacto_nombre, r.contacto_apellido, r.contacto_telefono,
              r.creado_por_id, r.monto_base, r.monto_grabacion,
              u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.email AS usuario_email
       FROM reservas r
       LEFT JOIN usuarios u ON u.usuario_id = r.usuario_id
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
