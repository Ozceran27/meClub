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

  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2024-03-15T12:00:00Z') });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('devuelve agregados de ingresos, reservas y gastos por mes/semana', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ estado_pago: 'pagado', total: 500 }, { estado_pago: 'senado', total: 200 }]])
      .mockResolvedValueOnce([[{ estado_pago: 'pagado', total: 150 }, { estado_pago: 'pendiente_pago', total: 50 }]])
      .mockResolvedValueOnce([[{ total: 12 }]])
      .mockResolvedValueOnce([[{ total: 4 }]])
      .mockResolvedValueOnce([[{ periodo: '2024-01', estado_pago: 'pagado', total: 200 }]])
      .mockResolvedValueOnce([[{ periodo: '2024-01', total: 80 }]]);

    GastosModel.obtenerTotalMes.mockResolvedValue(300);

    const data = await ClubesModel.obtenerEconomia(9);

    const monthRangeStart = new Date('2024-03-01T12:00:00Z');
    monthRangeStart.setMonth(monthRangeStart.getMonth() - 5);
    const periods = Array.from({ length: 6 }, (_, index) => {
      const current = new Date(monthRangeStart);
      current.setMonth(monthRangeStart.getMonth() + index);
      return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    });

    expect(mockQuery).toHaveBeenCalledTimes(6);
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
      ingresosMensualesHistoricos: periods.map((periodo) => ({
        periodo,
        total: periodo === '2024-01' ? 200 : 0,
      })),
      economiaMensual: periods.map((periodo) => ({
        periodo,
        ingresos: periodo === '2024-01'
          ? { pagado: 200, senado: 0, pendiente_pago: 0 }
          : { pagado: 0, senado: 0, pendiente_pago: 0 },
        gastos: periodo === '2024-01' ? 80 : 0,
        balance: periodo === '2024-01' ? 120 : 0,
      })),
    });
  });
});
