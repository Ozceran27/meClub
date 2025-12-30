const db = require('../config/db');

const normalizeRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    valor: row.valor === null ? null : Number(row.valor),
    usos_permitidos: row.usos_permitidos === null ? null : Number(row.usos_permitidos),
    usos_realizados: row.usos_realizados === null ? 0 : Number(row.usos_realizados),
    activo: row.activo === undefined ? true : Boolean(row.activo),
  };
};

const CuponesModel = {
  listarPorClub: async (clubId) => {
    const [rows] = await db.query(
      `SELECT cupon_id, club_id, nombre, usos_permitidos, usos_realizados, tipo_descuento, valor, activo,
              creado_en, actualizado_en
       FROM cupones
       WHERE club_id = ?
       ORDER BY creado_en DESC, cupon_id DESC`,
      [clubId]
    );
    return rows.map((row) => normalizeRow(row));
  },

  obtenerPorId: async (cuponId, clubId) => {
    const [rows] = await db.query(
      `SELECT cupon_id, club_id, nombre, usos_permitidos, usos_realizados, tipo_descuento, valor, activo,
              creado_en, actualizado_en
       FROM cupones
       WHERE cupon_id = ? AND club_id = ?
       LIMIT 1`,
      [cuponId, clubId]
    );
    return normalizeRow(rows[0]);
  },

  crear: async (clubId, payload) => {
    const [result] = await db.query(
      `INSERT INTO cupones
       (club_id, nombre, usos_permitidos, usos_realizados, tipo_descuento, valor, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        clubId,
        payload.nombre,
        payload.usos_permitidos,
        payload.usos_realizados ?? 0,
        payload.tipo_descuento,
        payload.valor,
        payload.activo ? 1 : 0,
      ]
    );
    return CuponesModel.obtenerPorId(result.insertId, clubId);
  },

  actualizar: async (cuponId, clubId, updates) => {
    const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (fields.length === 0) {
      return CuponesModel.obtenerPorId(cuponId, clubId);
    }

    const setters = [];
    const values = [];

    fields.forEach(([key, value]) => {
      setters.push(`${key} = ?`);
      if (key === 'activo') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    });

    values.push(cuponId, clubId);

    await db.query(
      `UPDATE cupones
       SET ${setters.join(', ')}
       WHERE cupon_id = ? AND club_id = ?`,
      values
    );

    return CuponesModel.obtenerPorId(cuponId, clubId);
  },

  eliminar: async (cuponId, clubId) => {
    const [result] = await db.query('DELETE FROM cupones WHERE cupon_id = ? AND club_id = ?', [
      cuponId,
      clubId,
    ]);
    return result.affectedRows > 0;
  },

  registrarUso: async (cuponId, clubId, { reserva_id = null, usuario_id = null } = {}) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT cupon_id, club_id, usos_permitidos, usos_realizados, activo
         FROM cupones
         WHERE cupon_id = ? AND club_id = ?
         FOR UPDATE`,
        [cuponId, clubId]
      );
      const cupon = rows[0];
      if (!cupon) {
        await connection.rollback();
        return null;
      }

      const usosPermitidos = Number(cupon.usos_permitidos) || 0;
      const usosRealizados = Number(cupon.usos_realizados) || 0;
      const activo = Boolean(cupon.activo);

      if (!activo || usosRealizados >= usosPermitidos) {
        await connection.query(
          `UPDATE cupones
           SET activo = 0
           WHERE cupon_id = ? AND club_id = ?`,
          [cuponId, clubId]
        );
        const error = new Error('El cupón ya no está disponible');
        error.code = 'CUPON_BLOQUEADO';
        throw error;
      }

      const nuevosUsos = usosRealizados + 1;
      const nuevoActivo = nuevosUsos < usosPermitidos;

      await connection.query(
        `INSERT INTO cupon_usos (cupon_id, reserva_id, usuario_id)
         VALUES (?, ?, ?)`,
        [cuponId, reserva_id, usuario_id]
      );

      await connection.query(
        `UPDATE cupones
         SET usos_realizados = ?, activo = ?
         WHERE cupon_id = ? AND club_id = ?`,
        [nuevosUsos, nuevoActivo ? 1 : 0, cuponId, clubId]
      );

      await connection.commit();
      return CuponesModel.obtenerPorId(cuponId, clubId);
    } catch (err) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error revirtiendo uso de cupón', rollbackError);
      }
      throw err;
    } finally {
      connection.release();
    }
  },
};

module.exports = { CuponesModel };
