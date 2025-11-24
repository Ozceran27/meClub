jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const db = require('../config/db');
const ReservasModel = require('../models/reservas.model');

describe('ReservasModel.actualizarEstados', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('actualiza estado y estado_pago cuando son válidos', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }, undefined]);

    const resultado = await ReservasModel.actualizarEstados({
      reserva_id: 10,
      estado: 'pendiente',
      estado_pago: 'pendiente_pago',
    });

    expect(db.query).toHaveBeenCalledWith(
      'UPDATE reservas SET estado = ?, estado_pago = ? WHERE reserva_id = ?',
      ['pendiente', 'pendiente_pago', 10]
    );
    expect(resultado).toEqual({
      updated: true,
      estado: 'pendiente',
      estado_pago: 'pendiente_pago',
    });
  });

  it('permite actualizar sólo el estado', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }, undefined]);

    const resultado = await ReservasModel.actualizarEstados({
      reserva_id: 5,
      estado: 'pagada',
    });

    expect(db.query).toHaveBeenCalledWith(
      'UPDATE reservas SET estado = ? WHERE reserva_id = ?',
      ['pagada', 5]
    );
    expect(resultado).toEqual({ updated: true, estado: 'pagada', estado_pago: undefined });
  });

  it('lanza error si no hay campos para actualizar', async () => {
    await expect(
      ReservasModel.actualizarEstados({ reserva_id: 5 })
    ).rejects.toMatchObject({ code: 'RESERVA_SIN_ACTUALIZACION' });
  });

  it('rechaza un estado inválido', async () => {
    await expect(
      ReservasModel.actualizarEstados({ reserva_id: 3, estado: 'invalido' })
    ).rejects.toMatchObject({ code: 'RESERVA_ESTADO_INVALIDO' });
  });

  it('rechaza un estado de pago inválido', async () => {
    await expect(
      ReservasModel.actualizarEstados({ reserva_id: 3, estado_pago: 'otro' })
    ).rejects.toMatchObject({ code: 'RESERVA_ESTADO_PAGO_INVALIDO' });
  });

  it('retorna updated en false cuando no se modifica ninguna fila', async () => {
    db.query.mockResolvedValue([{ affectedRows: 0 }, undefined]);

    const resultado = await ReservasModel.actualizarEstados({
      reserva_id: 11,
      estado: 'pendiente',
    });

    expect(resultado).toEqual({ updated: false, estado: 'pendiente', estado_pago: undefined });
  });
});
