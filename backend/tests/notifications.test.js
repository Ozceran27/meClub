jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../models/messages.model', () => ({
  createMessage: jest.fn(),
}));

const db = require('../config/db');
const MessagesModel = require('../models/messages.model');
const { notifyClubUsers } = require('../utils/notifications');

describe('notifyClubUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('envía el mensaje a todos los usuarios del club sin duplicados', async () => {
    db.query
      .mockResolvedValueOnce([[{ usuario_id: 1 }]])
      .mockResolvedValueOnce([[{ usuario_id: 2 }, { usuario_id: 1 }, { usuario_id: 3 }]]);

    MessagesModel.createMessage.mockResolvedValue({ id: 99 });

    const result = await notifyClubUsers({
      club_id: 10,
      title: 'Aviso importante',
      content: 'Mensaje masivo para el club',
    });

    expect(MessagesModel.createMessage).toHaveBeenCalledWith({
      club_id: 10,
      type: 'info',
      title: 'Aviso importante',
      content: 'Mensaje masivo para el club',
      sender: 'Sistema',
      targetUserIds: [1, 2, 3],
      connection: null,
    });
    expect(result).toEqual({ id: 99 });
  });
});
