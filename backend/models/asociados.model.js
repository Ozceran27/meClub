const db = require('../config/db');

const parsePagos = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) {
    return value.reduce((acc, item) => {
      if (typeof item === 'number' && Number.isFinite(item)) return acc + item;
      if (item && typeof item === 'object') {
        const monto = Number(item.monto);
        return Number.isFinite(monto) ? acc + monto : acc;
      }
      return acc;
    }, 0);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    try {
      const parsed = JSON.parse(trimmed);
      return parsePagos(parsed);
    } catch (err) {
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  if (typeof value === 'object') {
    const parsed = Number(value.monto);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeRow = (row) => ({
  ...row,
  pagos_realizados: parsePagos(row.pagos_realizados),
  cuota_mensual: row.cuota_mensual === null ? null : Number(row.cuota_mensual),
  fecha_pago: row.fecha_pago === null ? null : Number(row.fecha_pago),
  dias_gracia: row.dias_gracia === null ? null : Number(row.dias_gracia),
  estado_pago_manual: row.estado_pago_manual ?? null,
});

const AsociadosModel = {
  listarPorClub: async (clubId) => {
    const [rows] = await db.query(
      `SELECT a.asociado_id, a.usuario_id, a.club_id, a.tipo_asociado_id, a.nombre, a.apellido,
              a.dni, a.telefono, a.direccion, a.correo, a.pagos_realizados, a.fecha_inscripcion,
              a.estado_pago_manual, t.nombre AS tipo_nombre, t.cuota_mensual, t.fecha_pago,
              t.dias_gracia, t.color
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
              a.estado_pago_manual, t.nombre AS tipo_nombre, t.cuota_mensual, t.fecha_pago,
              t.dias_gracia, t.color
       FROM asociados a
       JOIN tipos_asociado t ON t.tipo_asociado_id = a.tipo_asociado_id
       WHERE a.asociado_id = ? AND a.club_id = ?
       LIMIT 1`,
      [asociadoId, clubId]
    );
    const row = rows[0];
    return row ? normalizeRow(row) : null;
  },

  buscarPorQuery: async (clubId, query, limit = 20) => {
    const term = `%${query}%`;
    const [rows] = await db.query(
      `SELECT a.asociado_id, a.usuario_id, a.club_id, a.tipo_asociado_id, a.nombre, a.apellido,
              a.dni, a.telefono, a.direccion, a.correo, a.pagos_realizados, a.fecha_inscripcion,
              a.estado_pago_manual, t.nombre AS tipo_nombre, t.cuota_mensual, t.fecha_pago,
              t.dias_gracia, t.color
       FROM asociados a
       JOIN tipos_asociado t ON t.tipo_asociado_id = a.tipo_asociado_id
       WHERE a.club_id = ?
         AND (a.nombre LIKE ? OR a.apellido LIKE ? OR a.telefono LIKE ?)
       ORDER BY a.nombre ASC, a.apellido ASC
       LIMIT ?`,
      [clubId, term, term, term, limit]
    );

    return rows.map((row) => normalizeRow(row));
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

  actualizarPagosRealizados: async (asociadoId, clubId, pagos_realizados) => {
    await db.query(
      'UPDATE asociados SET pagos_realizados = ? WHERE asociado_id = ? AND club_id = ?',
      [pagos_realizados, asociadoId, clubId]
    );
    return AsociadosModel.obtenerPorId(asociadoId, clubId);
  },

  actualizarEstadoPagoManual: async (asociadoId, clubId, estado_pago_manual) => {
    await db.query(
      'UPDATE asociados SET estado_pago_manual = ? WHERE asociado_id = ? AND club_id = ?',
      [estado_pago_manual, asociadoId, clubId]
    );
    return AsociadosModel.obtenerPorId(asociadoId, clubId);
  },
};

module.exports = AsociadosModel;
