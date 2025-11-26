const MessagesModel = require('../models/messages.model');
const UserInboxModel = require('../models/userInbox.model');
const ClubesModel = require('../models/clubes.model');
const { getUserId } = require('../utils/auth');

exports.createMessage = async (req, res) => {
  try {
    const {
      club_id,
      type = 'info',
      title,
      content,
      sender = 'Sistema',
      targetUserIds = [],
      broadcast = false,
    } = req.body;

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
      broadcast: broadcast === true || broadcast === 'true',
    });

    return res.status(201).json({ mensaje: 'Mensaje creado', message });
  } catch (error) {
    console.error('Error al crear mensaje:', error);
    return res.status(500).json({ mensaje: error.message || 'Error interno del servidor' });
  }
};

exports.broadcastMessage = async (req, res) => {
  try {
    const { type = 'info', title, content, sender = 'Sistema' } = req.body;

    if (!title || !content) {
      return res.status(400).json({ mensaje: 'title y content son requeridos' });
    }

    const clubIds = await ClubesModel.listClubIds();

    if (!clubIds.length) {
      return res.status(404).json({ mensaje: 'No hay clubes disponibles para enviar mensajes' });
    }

    const createdMessages = [];

    for (const clubId of clubIds) {
      // eslint-disable-next-line no-await-in-loop
      const message = await MessagesModel.createMessage({
        club_id: clubId,
        type,
        title,
        content,
        sender,
        broadcast: true,
      });
      createdMessages.push(message);
    }

    return res.status(201).json({
      mensaje: 'Mensajes enviados a todos los clubes',
      totalClubes: clubIds.length,
      mensajesCreados: createdMessages,
    });
  } catch (error) {
    console.error('Error al enviar mensajes de broadcast:', error);
    return res.status(500).json({ mensaje: error.message || 'Error interno del servidor' });
  }
};

exports.listInbox = async (req, res) => {
  try {
    const userId = getUserId(req.usuario);
    if (!userId) {
      return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    }

    const { page = 1, limit = 40 } = req.query;
    const inbox = await UserInboxModel.listUserInbox({ user_id: userId, page, limit });
    return res.json(inbox);
  } catch (error) {
    console.error('Error al listar inbox:', error);
    return res.status(500).json({ mensaje: error.message || 'Error interno del servidor' });
  }
};

exports.inboxSummary = async (req, res) => {
  try {
    const userId = getUserId(req.usuario);
    if (!userId) {
      return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    }

    const summary = await UserInboxModel.getInboxSummary({ user_id: userId });
    return res.json(summary);
  } catch (error) {
    console.error('Error al obtener resumen de inbox:', error);
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

exports.deleteInbox = async (req, res) => {
  try {
    const userId = getUserId(req.usuario);
    if (!userId) {
      return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    }

    const inboxId = Number(req.params.inboxId);
    if (!Number.isInteger(inboxId)) {
      return res.status(400).json({ mensaje: 'inboxId inválido' });
    }

    const deleted = await UserInboxModel.deleteFromInbox({ inbox_id: inboxId, user_id: userId });
    if (!deleted) {
      return res.status(404).json({ mensaje: 'Mensaje no encontrado en la bandeja' });
    }

    return res.json({ mensaje: 'Mensaje eliminado' });
  } catch (error) {
    console.error('Error al eliminar mensaje de inbox:', error);
    return res.status(500).json({ mensaje: error.message || 'Error interno del servidor' });
  }
};
