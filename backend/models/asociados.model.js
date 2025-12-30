const db = require('../config/db');

const parsePagos = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const normalizeRow = (row) => ({
  ...row,
  pagos_realizados: parsePagos(row.pagos_realizados),
  cuota_mensual: row.cuota_mensual === null ? null : Number(row.cuota_mensual),
  fecha_pago: row.fecha_pago === null ? null : Number(row.fecha_pago),
  dias_gracia: row.dias_gracia === null ? null : Number(row.dias_gracia),
});

const AsociadosModel = {
  listarPorClub: async (clubId) => {
    const [rows] = await db.query(
      `SELECT a.asociado_id, a.usuario_id, a.club_id, a.tipo_asociado_id, a.nombre, a.apellido,
              a.dni, a.telefono, a.direccion, a.correo, a.pagos_realizados, a.fecha_inscripcion,
              t.nombre AS tipo_nombre, t.cuota_mensual, t.fecha_pago, t.dias_gracia, t.color
       FROM asociados a
       JOIN tipos_asociado t ON t.tipo_asociado_id = a.tipo_asociado_id
       WHERE a.club_id = ?
       ORDER BY a.fecha_inscripcion DESC, a.asociado_id DESC`,
      [clubId]
    );

    return rows.map((row) => normalizeRow(row));
  },

  obtenerPorId: async (asociadoId, clubId) => {
    const [rows] = await db.query(
      `SELECT a.asociado_id, a.usuario_id, a.club_id, a.tipo_asociado_id, a.nombre, a.apellido,
              a.dni, a.telefono, a.direccion, a.correo, a.pagos_realizados, a.fecha_inscripcion,
              t.nombre AS tipo_nombre, t.cuota_mensual, t.fecha_pago, t.dias_gracia, t.color
       FROM asociados a
       JOIN tipos_asociado t ON t.tipo_asociado_id = a.tipo_asociado_id
       WHERE a.asociado_id = ? AND a.club_id = ?
       LIMIT 1`,
      [asociadoId, clubId]
    );
    const row = rows[0];
    return row ? normalizeRow(row) : null;
  },

  crear: async (clubId, payload) => {
    const [result] = await db.query(
      `INSERT INTO asociados
       (club_id, tipo_asociado_id, usuario_id, nombre, apellido, dni, telefono, direccion, correo,
        pagos_realizados, fecha_inscripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clubId,
        payload.tipo_asociado_id,
        payload.usuario_id,
        payload.nombre,
        payload.apellido,
        payload.dni,
        payload.telefono,
        payload.direccion,
        payload.correo,
        payload.pagos_realizados,
        payload.fecha_inscripcion,
      ]
    );

    return AsociadosModel.obtenerPorId(result.insertId, clubId);
  },

  eliminar: async (asociadoId, clubId) => {
    const [result] = await db.query(
      'DELETE FROM asociados WHERE asociado_id = ? AND club_id = ?',
      [asociadoId, clubId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = AsociadosModel;
