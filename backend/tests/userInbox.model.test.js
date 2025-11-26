jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const db = require('../config/db');
const UserInboxModel = require('../models/userInbox.model');

describe('UserInboxModel.listUserInbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usa paginación de 40 items y ordena por fecha descendente', async () => {
    db.query
      .mockResolvedValueOnce([[{ total: 2 }]])
      .mockResolvedValueOnce([[{ id: 1 }]]);

    const result = await UserInboxModel.listUserInbox({ user_id: 9 });

    expect(db.query).toHaveBeenNthCalledWith(1, 'SELECT COUNT(*) AS total FROM user_inbox WHERE user_id = ?', [9]);
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ORDER BY ui.created_at DESC'),
      [9, 40, 0]
    );
    expect(result).toEqual({ page: 1, limit: 40, total: 2, inbox: [{ id: 1 }] });
  });
});

describe('UserInboxModel.deleteFromInbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('elimina un registro de inbox del usuario', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const deleted = await UserInboxModel.deleteFromInbox({ inbox_id: 4, user_id: 11 });

    expect(db.query).toHaveBeenCalledWith('DELETE FROM user_inbox WHERE id = ? AND user_id = ?', [4, 11]);
    expect(deleted).toBe(true);
  });

  it('retorna false cuando no encuentra filas para eliminar', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const deleted = await UserInboxModel.deleteFromInbox({ inbox_id: 7, user_id: 33 });

    expect(deleted).toBe(false);
  });
});
