const mockQuery = jest.fn();

jest.mock('../config/db', () => ({
  query: mockQuery,
  getConnection: jest.fn(),
}));

const GastosModel = require('../models/gastos.model');

jest.mock('../models/gastos.model', () => ({
  obtenerTotalMes: jest.fn(),
}));

const ClubesModel = require('../models/clubes.model');

describe('ClubesModel.obtenerEconomia', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    GastosModel.obtenerTotalMes.mockReset();
  });

  it('devuelve agregados de ingresos, reservas y gastos por mes/semana', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ estado_pago: 'pagado', total: 500 }, { estado_pago: 'senado', total: 200 }]])
      .mockResolvedValueOnce([[{ estado_pago: 'pagado', total: 150 }, { estado_pago: 'pendiente_pago', total: 50 }]])
      .mockResolvedValueOnce([[{ total: 12 }]])
      .mockResolvedValueOnce([[{ total: 4 }]]);

    GastosModel.obtenerTotalMes.mockResolvedValue(300);

    const data = await ClubesModel.obtenerEconomia(9);

    expect(mockQuery).toHaveBeenCalledTimes(4);
    expect(GastosModel.obtenerTotalMes).toHaveBeenCalledWith(9);

    expect(data).toEqual({
      ingresos: {
        mes: { pagado: 500, senado: 200, pendiente_pago: 0 },
        semana: { pagado: 150, senado: 0, pendiente_pago: 50 },
      },
      reservas: { mes: 12, semana: 4 },
      proyeccion: { mes: 700, semana: 200 },
      gastos: { mes: 300 },
      balanceMensual: 400,
    });
  });
});
