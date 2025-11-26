const MessagesModel = require('../models/messages.model');
const UserInboxModel = require('../models/userInbox.model');
const { getUserId } = require('../utils/auth');

exports.createMessage = async (req, res) => {
  try {
    const { club_id, type = 'info', title, content, sender = 'Sistema', targetUserIds = [] } = req.body;

    if (!club_id || !title || !content) {
      return res.status(400).json({ mensaje: 'club_id, title y content son requeridos' });
    }

    const message = await MessagesModel.createMessage({
      club_id,
      type,
      title,
      content,
      sender,
      targetUserIds,
    });

    return res.status(201).json({ mensaje: 'Mensaje creado', message });
  } catch (error) {
    console.error('Error al crear mensaje:', error);
    return res.status(500).json({ mensaje: error.message || 'Error interno del servidor' });
  }
};

exports.listInbox = async (req, res) => {
  try {
    const userId = getUserId(req.usuario);
    if (!userId) {
      return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    }

    const { page = 1, limit = 20 } = req.query;
    const inbox = await UserInboxModel.listUserInbox({ user_id: userId, page, limit });
    return res.json(inbox);
  } catch (error) {
    console.error('Error al listar inbox:', error);
    return res.status(500).json({ mensaje: error.message || 'Error interno del servidor' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = getUserId(req.usuario);
    if (!userId) {
      return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    }

    const inboxId = Number(req.params.inboxId);
    if (!Number.isInteger(inboxId)) {
      return res.status(400).json({ mensaje: 'inboxId inválido' });
    }

    const updated = await UserInboxModel.markAsRead({ inbox_id: inboxId, user_id: userId });
    if (!updated) {
      return res.status(404).json({ mensaje: 'Mensaje no encontrado en la bandeja' });
    }

    return res.json({ mensaje: 'Mensaje marcado como leído' });
  } catch (error) {
    console.error('Error al marcar mensaje como leído:', error);
    return res.status(500).json({ mensaje: error.message || 'Error interno del servidor' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const messageId = Number(req.params.messageId);
    const { club_id } = req.body;

    if (!Number.isInteger(messageId)) {
      return res.status(400).json({ mensaje: 'messageId inválido' });
    }
    if (!club_id) {
      return res.status(400).json({ mensaje: 'club_id es requerido' });
    }

    await MessagesModel.deleteMessage({ message_id: messageId, club_id });
    return res.json({ mensaje: 'Mensaje eliminado' });
  } catch (error) {
    if (error.code === 'MENSAJE_NO_ENCONTRADO') {
      return res.status(404).json({ mensaje: 'Mensaje no encontrado' });
    }
    console.error('Error al eliminar mensaje:', error);
    return res.status(500).json({ mensaje: error.message || 'Error interno del servidor' });
  }
};
