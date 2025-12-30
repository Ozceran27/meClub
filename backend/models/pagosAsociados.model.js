const db = require('../config/db');

let tableChecked = false;
let tableAvailable = false;

const ensureTableExists = async () => {
  if (tableChecked) return tableAvailable;
  const [rows] = await db.query("SHOW TABLES LIKE 'pagos_asociados'");
  tableAvailable = rows.length > 0;
  tableChecked = true;
  return tableAvailable;
};

const PagosAsociadosModel = {
  registrarPago: async ({ asociado_id, club_id, monto, fecha_pago }) => {
    const exists = await ensureTableExists();
    if (!exists) return false;
    await db.query(
      `INSERT INTO pagos_asociados (asociado_id, club_id, monto, fecha_pago)
       VALUES (?, ?, ?, ?)`,
      [asociado_id, club_id, monto, fecha_pago]
    );
    return true;
  },
};

module.exports = PagosAsociadosModel;
