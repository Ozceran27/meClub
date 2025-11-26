const db = require('../config/db');
const MessagesModel = require('../models/messages.model');

const obtenerUsuariosDelClub = async ({ club_id, connection = null }) => {
  const executor = connection || db;

  const [clubRows] = await executor.query('SELECT usuario_id FROM clubes WHERE club_id = ?', [club_id]);
  const [clubUsersRows] = await executor.query(
    'SELECT usuario_id FROM clubs_usuarios WHERE club_id = ?',
    [club_id]
  );

  const ids = new Set();

  clubRows.forEach((row) => {
    const id = Number(row.usuario_id);
    if (Number.isInteger(id)) {
      ids.add(id);
    }
  });

  clubUsersRows.forEach((row) => {
    const id = Number(row.usuario_id);
    if (Number.isInteger(id)) {
      ids.add(id);
    }
  });

  return Array.from(ids);
};

const notifyClubUsers = async ({
  club_id,
  type = 'info',
  title,
  content,
  sender = 'Sistema',
  connection = null,
}) => {
  if (club_id === undefined || club_id === null) {
    throw new Error('club_id es requerido para notificar');
  }
  if (!title) throw new Error('title es requerido para notificar');
  if (!content) throw new Error('content es requerido para notificar');

  const targetUserIds = await obtenerUsuariosDelClub({ club_id, connection });
  return MessagesModel.createMessage({
    club_id,
    type,
    title,
    content,
    sender,
    targetUserIds,
    connection,
  });
};

module.exports = { notifyClubUsers };
