const db = require('../config/db');

const MessagesModel = {
  createMessage: async ({
    club_id,
    type = 'info',
    title,
    content,
    sender = 'Sistema',
    targetUserIds = [],
    connection: externalConnection = null,
  }) => {
    if (club_id === undefined || club_id === null) {
      throw new Error('club_id es requerido');
    }
    if (!title) {
      throw new Error('title es requerido');
    }
    if (!content) {
      throw new Error('content es requerido');
    }

    const sanitizedTargetIds = Array.isArray(targetUserIds)
      ? [...new Set(targetUserIds.map((id) => Number(id)).filter(Number.isInteger))]
      : [];

    const connection = externalConnection || (await db.getConnection());
    const manageTransaction = !externalConnection;

    try {
      if (manageTransaction) {
        await connection.beginTransaction();
      }

      const [messageResult] = await connection.query(
        `INSERT INTO messages (club_id, type, title, content, sender)
         VALUES (?, ?, ?, ?, ?)`,
        [club_id, type || 'info', title, content, sender || 'Sistema']
      );

      const messageId = messageResult.insertId;

      if (sanitizedTargetIds.length > 0) {
        const values = sanitizedTargetIds.map((userId) => [userId, club_id, messageId]);
        await connection.query(
          'INSERT INTO user_inbox (user_id, club_id, message_id) VALUES ?',
          [values]
        );
      }

      if (manageTransaction) {
        await connection.commit();
      }

      return {
        id: messageId,
        club_id,
        type: type || 'info',
        title,
        content,
        sender: sender || 'Sistema',
      };
    } catch (error) {
      if (manageTransaction) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error('Error al revertir la transacción de creación de mensaje', rollbackError);
        }
      }
      throw error;
    } finally {
      if (manageTransaction) {
        connection.release();
      }
    }
  },

  deleteMessage: async ({ message_id, club_id }) => {
    if (message_id === undefined || message_id === null) {
      throw new Error('message_id es requerido');
    }
    if (club_id === undefined || club_id === null) {
      throw new Error('club_id es requerido');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [messageRows] = await connection.query(
        'SELECT id FROM messages WHERE id = ? AND club_id = ? FOR UPDATE',
        [message_id, club_id]
      );

      if (messageRows.length === 0) {
        const error = new Error('Mensaje no encontrado');
        error.code = 'MENSAJE_NO_ENCONTRADO';
        throw error;
      }

      await connection.query('DELETE FROM user_inbox WHERE message_id = ?', [message_id]);
      await connection.query('DELETE FROM messages WHERE id = ? AND club_id = ?', [message_id, club_id]);

      await connection.commit();
      return true;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error al revertir la transacción de eliminación de mensaje', rollbackError);
      }
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = MessagesModel;
