const db = require('../config/db');

const normalizeDecimal = (value, fieldName) => {
  if (value === undefined || value === null) return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${fieldName} debe ser un número positivo`);
  }

  return Math.round(numeric * 100) / 100;
};

const normalizeString = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${fieldName} es obligatorio`);
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    if (required) throw new Error(`${fieldName} es obligatorio`);
    return null;
  }

  return trimmed.slice(0, 150);
};

const normalizeDate = (value) => {
  if (value === undefined || value === null || value === '') {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('fecha inválida');
  }

  return parsed;
};

const GastosModel = {
  listarPorMes: async (clubId, fechaReferencia = new Date(), options = {}) => {
    const limit = Number(options.limit) || 20;
    const page = Number(options.page) || 1;
    const normalizedLimit = Math.max(1, Math.min(limit, 100));
    const normalizedPage = Math.max(1, page);
    const offset = (normalizedPage - 1) * normalizedLimit;

    const [rows] = await db.query(
      `SELECT gasto_id, club_id, categoria, descripcion, monto, fecha
       FROM gastos
       WHERE club_id = ?
         AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')
       ORDER BY fecha DESC, gasto_id DESC
       LIMIT ? OFFSET ?`,
      [clubId, fechaReferencia, normalizedLimit, offset]
    );

    const gastos = rows.map((row) => ({
      ...row,
      monto: row.monto === null ? 0 : Number(row.monto),
      descripcion: row.descripcion || null,
    }));

    const [resumenRows] = await db.query(
      `SELECT categoria, COALESCE(SUM(monto), 0) AS total
       FROM gastos
       WHERE club_id = ?
         AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')
       GROUP BY categoria`,
      [clubId, fechaReferencia]
    );

    const porCategoria = resumenRows.map((row) => ({
      categoria: row.categoria || 'Sin categoría',
      total: row.total === null ? 0 : Number(row.total),
    }));

    const total = porCategoria.reduce((acc, row) => acc + row.total, 0);

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM gastos
       WHERE club_id = ?
         AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')`,
      [clubId, fechaReferencia]
    );

    const totalFilas = countRows?.[0]?.total ?? 0;
    const totalPaginas = Math.max(1, Math.ceil(totalFilas / normalizedLimit));

    return {
      gastos,
      resumen: { porCategoria, total },
      meta: {
        total: totalFilas,
        limit: normalizedLimit,
        page: normalizedPage,
        totalPaginas,
      },
    };
  },

  crear: async (clubId, { categoria, descripcion = null, monto, fecha }) => {
    const categoriaValue = normalizeString(categoria, 'categoria', { required: true });
    const descripcionValue = descripcion === undefined ? null : normalizeString(descripcion, 'descripcion');
    const montoValue = normalizeDecimal(monto, 'monto');
    const fechaValue = normalizeDate(fecha);

    const [result] = await db.query(
      `INSERT INTO gastos (club_id, categoria, descripcion, monto, fecha)
       VALUES (?, ?, ?, ?, ?)`,
      [clubId, categoriaValue, descripcionValue, montoValue, fechaValue]
    );

    return {
      gasto_id: result.insertId,
      club_id: clubId,
      categoria: categoriaValue,
      descripcion: descripcionValue,
      monto: montoValue,
      fecha: fechaValue,
    };
  },

  actualizar: async (gastoId, clubId, { categoria, descripcion, monto, fecha }) => {
    const fields = {};
    if (categoria !== undefined) fields.categoria = normalizeString(categoria, 'categoria');
    if (descripcion !== undefined) fields.descripcion = normalizeString(descripcion, 'descripcion');
    if (monto !== undefined) fields.monto = normalizeDecimal(monto, 'monto');
    if (fecha !== undefined) fields.fecha = normalizeDate(fecha);

    if (Object.keys(fields).length === 0) {
      return GastosModel.obtenerPorId(gastoId, clubId);
    }

    const setters = [];
    const values = [];

    Object.entries(fields).forEach(([key, value]) => {
      setters.push(`${key} = ?`);
      values.push(value);
    });

    values.push(gastoId, clubId);

    await db.query(`UPDATE gastos SET ${setters.join(', ')} WHERE gasto_id = ? AND club_id = ?`, values);

    return GastosModel.obtenerPorId(gastoId, clubId);
  },

  eliminar: async (gastoId, clubId) => {
    const [result] = await db.query('DELETE FROM gastos WHERE gasto_id = ? AND club_id = ?', [
      gastoId,
      clubId,
    ]);

    return result.affectedRows > 0;
  },

  obtenerPorId: async (gastoId, clubId) => {
    const [rows] = await db.query(
      `SELECT gasto_id, club_id, categoria, descripcion, monto, fecha
       FROM gastos
       WHERE gasto_id = ? AND club_id = ?
       LIMIT 1`,
      [gastoId, clubId]
    );

    const row = rows[0];
    if (!row) return null;

    return {
      ...row,
      descripcion: row.descripcion || null,
      monto: row.monto === null ? 0 : Number(row.monto),
    };
  },

  obtenerTotalMes: async (clubId, fechaReferencia = new Date()) => {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(monto), 0) AS total
       FROM gastos
       WHERE club_id = ?
         AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')`,
      [clubId, fechaReferencia]
    );

    const total = rows?.[0]?.total;
    return total === null || total === undefined ? 0 : Number(total);
  },
};

module.exports = GastosModel;
