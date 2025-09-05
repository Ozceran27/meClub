const db = require('../config/db');

const PasswordResetsModel = {
  insert: async (token_hash, usuario_id, expira) => {
    await db.query(
      'INSERT INTO password_resets (token_hash, usuario_id, expira) VALUES (?, ?, ?)',
      [token_hash, usuario_id, expira]
    );
  },

  findByHash: async (token_hash) => {
    const [rows] = await db.query(
      'SELECT token_hash, usuario_id, expira FROM password_resets WHERE token_hash = ?',
      [token_hash]
    );
    return rows[0] || null;
  },

  delete: async (token_hash) => {
    await db.query('DELETE FROM password_resets WHERE token_hash = ?', [token_hash]);
  },

  deleteExpired: async () => {
    await db.query('DELETE FROM password_resets WHERE expira < NOW()');
  }
};

module.exports = PasswordResetsModel;
