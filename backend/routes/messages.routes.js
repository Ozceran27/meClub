const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const messagesController = require('../controllers/messages.controller');

router.get('/', verifyToken, messagesController.listInbox);
router.get('/inbox', verifyToken, messagesController.listInbox);
router.post('/', verifyToken, requireRole('club'), messagesController.createMessage);
router.patch('/inbox/:inboxId/leer', verifyToken, messagesController.markAsRead);
router.delete('/inbox/:inboxId', verifyToken, messagesController.deleteInbox);
router.delete('/:messageId', verifyToken, requireRole('club'), messagesController.deleteMessage);

module.exports = router;
