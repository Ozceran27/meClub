const db = require('../config/db');

const normalizeRow = (row) => ({
  ...row,
  cuota_mensual: row.cuota_mensual === null ? null : Number(row.cuota_mensual),
  fecha_pago: row.fecha_pago === null ? null : Number(row.fecha_pago),
  dias_gracia: row.dias_gracia === null ? null : Number(row.dias_gracia),
});

const mapServicios = (rows = []) => {
  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.tipo_asociado_id)) {
      grouped.set(row.tipo_asociado_id, []);
    }
    grouped.get(row.tipo_asociado_id).push({
      servicio_id: row.servicio_id,
      nombre: row.nombre,
      slug: row.slug,
      descripcion: row.descripcion,
      icono: row.icono,
    });
  });
  return grouped;
};

const TipoAsociadoModel = {
  listarPorClub: async (clubId) => {
    const [rows] = await db.query(
      `SELECT tipo_asociado_id, club_id, nombre, cuota_mensual, fecha_pago, dias_gracia, color,
              creado_en, actualizado_en
       FROM tipos_asociado
       WHERE club_id = ?
       ORDER BY creado_en DESC, tipo_asociado_id DESC`,
      [clubId]
    );

    if (!rows.length) return [];

    const ids = rows.map((row) => row.tipo_asociado_id);
    const [serviciosRows] = await db.query(
      `SELECT tas.tipo_asociado_id, s.servicio_id, s.slug, s.nombre, s.descripcion, s.icono
       FROM tipo_asociado_servicios tas
       JOIN servicios s ON tas.servicio_id = s.servicio_id
       WHERE tas.tipo_asociado_id IN (?)
       ORDER BY s.nombre ASC`,
      [ids]
    );

    const serviciosMap = mapServicios(serviciosRows);
    return rows.map((row) => ({
      ...normalizeRow(row),
      servicios_incluidos: serviciosMap.get(row.tipo_asociado_id) || [],
    }));
  },

  obtenerPorId: async (tipoId, clubId) => {
    const [rows] = await db.query(
      `SELECT tipo_asociado_id, club_id, nombre, cuota_mensual, fecha_pago, dias_gracia, color,
              creado_en, actualizado_en
       FROM tipos_asociado
       WHERE tipo_asociado_id = ? AND club_id = ?
       LIMIT 1`,
      [tipoId, clubId]
    );

    const row = rows[0];
    if (!row) return null;

    const [serviciosRows] = await db.query(
      `SELECT tas.tipo_asociado_id, s.servicio_id, s.slug, s.nombre, s.descripcion, s.icono
       FROM tipo_asociado_servicios tas
       JOIN servicios s ON tas.servicio_id = s.servicio_id
       WHERE tas.tipo_asociado_id = ?
       ORDER BY s.nombre ASC`,
      [tipoId]
    );

    return {
      ...normalizeRow(row),
      servicios_incluidos: mapServicios(serviciosRows).get(row.tipo_asociado_id) || [],
    };
  },

  crear: async (clubId, payload, servicioIds = []) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO tipos_asociado
         (club_id, nombre, cuota_mensual, fecha_pago, dias_gracia, color)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          clubId,
          payload.nombre,
          payload.cuota_mensual,
          payload.fecha_pago,
          payload.dias_gracia,
          payload.color,
        ]
      );

      const tipoId = result.insertId;

      if (servicioIds.length) {
        const values = servicioIds.map((servicioId) => [tipoId, servicioId]);
        await conn.query(
          'INSERT INTO tipo_asociado_servicios (tipo_asociado_id, servicio_id) VALUES ?',
          [values]
        );
      }

      await conn.commit();
      return TipoAsociadoModel.obtenerPorId(tipoId, clubId);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  actualizar: async (tipoId, clubId, updates, servicioIds) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
      if (fields.length) {
        const setters = [];
        const values = [];
        fields.forEach(([key, value]) => {
          setters.push(`${key} = ?`);
          values.push(value);
        });
        values.push(tipoId, clubId);
        await conn.query(
          `UPDATE tipos_asociado
           SET ${setters.join(', ')}
           WHERE tipo_asociado_id = ? AND club_id = ?`,
          values
        );
      }

      if (Array.isArray(servicioIds)) {
        await conn.query('DELETE FROM tipo_asociado_servicios WHERE tipo_asociado_id = ?', [tipoId]);
        if (servicioIds.length) {
          const values = servicioIds.map((servicioId) => [tipoId, servicioId]);
          await conn.query(
            'INSERT INTO tipo_asociado_servicios (tipo_asociado_id, servicio_id) VALUES ?',
            [values]
          );
        }
      }

      await conn.commit();
      return TipoAsociadoModel.obtenerPorId(tipoId, clubId);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  eliminar: async (tipoId, clubId) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM tipo_asociado_servicios WHERE tipo_asociado_id = ?', [tipoId]);
      const [result] = await conn.query(
        'DELETE FROM tipos_asociado WHERE tipo_asociado_id = ? AND club_id = ?',
        [tipoId, clubId]
      );
      await conn.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },
};

module.exports = TipoAsociadoModel;
