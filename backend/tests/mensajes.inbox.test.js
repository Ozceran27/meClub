const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth.middleware', () => (req, res, next) => {
  req.usuario = { id: 77 };
  next();
});

jest.mock('../middleware/roles.middleware', () => ({
  requireRole: () => (req, res, next) => next(),
}));

jest.mock('../models/messages.model', () => ({
  createMessage: jest.fn(),
  deleteMessage: jest.fn(),
}));

jest.mock('../models/userInbox.model', () => ({
  listUserInbox: jest.fn(),
  markAsRead: jest.fn(),
  deleteFromInbox: jest.fn(),
}));

const messagesRoutes = require('../routes/messages.routes');
const MessagesModel = require('../models/messages.model');
const UserInboxModel = require('../models/userInbox.model');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', messagesRoutes);
  return app;
};

describe('Rutas de mensajes e inbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista el inbox con paginación de 40 elementos', async () => {
    const app = buildApp();
    UserInboxModel.listUserInbox.mockResolvedValue({ page: 1, limit: 40, total: 0, inbox: [] });

    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(UserInboxModel.listUserInbox).toHaveBeenCalledWith({ user_id: 77, page: 1, limit: 40 });
    expect(res.body.limit).toBe(40);
  });

  it('crea un mensaje de sistema para el club', async () => {
    const app = buildApp();
    MessagesModel.createMessage.mockResolvedValue({ id: 10 });

    const res = await request(app)
      .post('/')
      .send({ club_id: 5, title: 'Aviso', content: 'Probando', targetUserIds: [1, 2] });

    expect(res.status).toBe(201);
    expect(MessagesModel.createMessage).toHaveBeenCalledWith({
      club_id: 5,
      type: 'info',
      title: 'Aviso',
      content: 'Probando',
      sender: 'Sistema',
      targetUserIds: [1, 2],
    });
  });

  it('marca mensajes como leídos al abrir el detalle', async () => {
    const app = buildApp();
    UserInboxModel.markAsRead.mockResolvedValue(true);

    const res = await request(app).patch('/inbox/9/leer');

    expect(res.status).toBe(200);
    expect(UserInboxModel.markAsRead).toHaveBeenCalledWith({ inbox_id: 9, user_id: 77 });
  });

  it('elimina un elemento del inbox del usuario', async () => {
    const app = buildApp();
    UserInboxModel.deleteFromInbox.mockResolvedValue(true);

    const res = await request(app).delete('/inbox/12');

    expect(res.status).toBe(200);
    expect(UserInboxModel.deleteFromInbox).toHaveBeenCalledWith({ inbox_id: 12, user_id: 77 });
  });

  it('retorna 404 al eliminar un inbox inexistente', async () => {
    const app = buildApp();
    UserInboxModel.deleteFromInbox.mockResolvedValue(false);

    const res = await request(app).delete('/inbox/99');

    expect(res.status).toBe(404);
  });
});
