const db = require('../config/db');

const UserInboxModel = {
  listUserInbox: async ({ user_id, page = 1, limit = 40 }) => {
    if (user_id === undefined || user_id === null) {
      throw new Error('user_id es requerido');
    }
    const pageNumber = Number.parseInt(page, 10);
    const limitNumber = Number.parseInt(limit, 10);
    const sanitizedPage = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const sanitizedLimit = Number.isInteger(limitNumber) && limitNumber > 0 ? limitNumber : 40;
    const offset = (sanitizedPage - 1) * sanitizedLimit;

    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM user_inbox WHERE user_id = ?',
      [user_id]
    );

    const [rows] = await db.query(
      `SELECT
         ui.id AS inbox_id,
         ui.user_id,
         ui.club_id,
         ui.message_id,
         ui.is_read,
         ui.read_at,
         ui.created_at,
         m.type,
         m.title,
         m.content,
         m.sender,
         m.created_at AS message_created_at
       FROM user_inbox ui
       INNER JOIN messages m ON m.id = ui.message_id
       WHERE ui.user_id = ?
       ORDER BY ui.created_at DESC
       LIMIT ? OFFSET ?`,
      [user_id, sanitizedLimit, offset]
    );

    return {
      page: sanitizedPage,
      limit: sanitizedLimit,
      total,
      inbox: rows,
    };
  },

  markAsRead: async ({ inbox_id, user_id }) => {
    if (inbox_id === undefined || inbox_id === null) {
      throw new Error('inbox_id es requerido');
    }
    if (user_id === undefined || user_id === null) {
      throw new Error('user_id es requerido');
    }

    const [result] = await db.query(
      `UPDATE user_inbox
       SET is_read = 1,
           read_at = IF(read_at IS NULL, NOW(), read_at)
       WHERE id = ? AND user_id = ?`,
      [inbox_id, user_id]
    );

    return result.affectedRows > 0;
  },

  deleteFromInbox: async ({ inbox_id, user_id }) => {
    if (inbox_id === undefined || inbox_id === null) {
      throw new Error('inbox_id es requerido');
    }
    if (user_id === undefined || user_id === null) {
      throw new Error('user_id es requerido');
    }

    const [result] = await db.query('DELETE FROM user_inbox WHERE id = ? AND user_id = ?', [
      inbox_id,
      user_id,
    ]);

    return result.affectedRows > 0;
  },

  getInboxSummary: async ({ user_id }) => {
    if (user_id === undefined || user_id === null) {
      throw new Error('user_id es requerido');
    }

    const [[counts]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN is_read = 0 OR is_read IS NULL THEN 1 ELSE 0 END) AS unread
       FROM user_inbox
       WHERE user_id = ?`,
      [user_id]
    );

    return {
      total: Number.parseInt(counts.total, 10) || 0,
      unreadCount: Number.parseInt(counts.unread, 10) || 0,
    };
  },
};

module.exports = UserInboxModel;
