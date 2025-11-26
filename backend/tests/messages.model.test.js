jest.mock('../config/db', () => ({
  getConnection: jest.fn(),
}));

const db = require('../config/db');
const MessagesModel = require('../models/messages.model');

describe('MessagesModel.createMessage', () => {
  const buildConnection = () => {
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    };

    db.getConnection.mockResolvedValue(connection);
    return connection;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('crea el mensaje y las entradas de inbox cuando hay destinatarios', async () => {
    const connection = buildConnection();

    connection.query
      .mockResolvedValueOnce([{ insertId: 15 }])
      .mockResolvedValueOnce([{}]);

    const payload = {
      club_id: 7,
      type: 'system',
      title: 'Nueva actualización',
      content: 'Contenido del mensaje',
      sender: 'Sistema',
      targetUserIds: [1, 2, '2', 'no-numero', 3],
    };

    const result = await MessagesModel.createMessage(payload);

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenNthCalledWith(
      1,
      `INSERT INTO messages (club_id, type, title, content, sender)
         VALUES (?, ?, ?, ?, ?)` ,
      [7, 'system', 'Nueva actualización', 'Contenido del mensaje', 'Sistema']
    );
    expect(connection.query).toHaveBeenNthCalledWith(2, 'INSERT INTO user_inbox (user_id, club_id, message_id) VALUES ?', [
      [
        [1, 7, 15],
        [2, 7, 15],
        [3, 7, 15],
      ],
    ]);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: 15,
      club_id: 7,
      type: 'system',
      title: 'Nueva actualización',
      content: 'Contenido del mensaje',
      sender: 'Sistema',
    });
  });

  it('omite la inserción en inbox cuando no hay destinatarios', async () => {
    const connection = buildConnection();

    connection.query.mockResolvedValueOnce([{ insertId: 5 }]);

    const result = await MessagesModel.createMessage({
      club_id: 3,
      title: 'Solo para historial',
      content: 'Mensaje sin destinatarios',
      targetUserIds: [],
    });

    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenCalledWith(
      `INSERT INTO messages (club_id, type, title, content, sender)
         VALUES (?, ?, ?, ?, ?)` ,
      [3, 'info', 'Solo para historial', 'Mensaje sin destinatarios', 'Sistema']
    );
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(5);
  });

  it('obtiene los usuarios del club cuando se activa broadcast y no hay destinatarios', async () => {
    const connection = buildConnection();

    connection.query
      .mockResolvedValueOnce([[{ usuario_id: 22 }]])
      .mockResolvedValueOnce([[{ usuario_id: 30 }, { usuario_id: 22 }]])
      .mockResolvedValueOnce([{ insertId: 18 }])
      .mockResolvedValueOnce([{}]);

    const result = await MessagesModel.createMessage({
      club_id: 12,
      title: 'Aviso general',
      content: 'Mensaje para todos',
      broadcast: true,
    });

    expect(connection.query).toHaveBeenNthCalledWith(1, 'SELECT usuario_id FROM clubes WHERE club_id = ?', [12]);
    expect(connection.query).toHaveBeenNthCalledWith(2, 'SELECT usuario_id FROM clubs_usuarios WHERE club_id = ?', [12]);
    expect(connection.query).toHaveBeenNthCalledWith(
      3,
      `INSERT INTO messages (club_id, type, title, content, sender)
         VALUES (?, ?, ?, ?, ?)` ,
      [12, 'info', 'Aviso general', 'Mensaje para todos', 'Sistema']
    );
    expect(connection.query).toHaveBeenNthCalledWith(4, 'INSERT INTO user_inbox (user_id, club_id, message_id) VALUES ?', [
      [
        [22, 12, 18],
        [30, 12, 18],
      ],
    ]);
    expect(result.id).toBe(18);
  });
});
