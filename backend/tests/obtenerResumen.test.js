const mockQuery = jest.fn();

jest.mock('../config/db', () => ({
  query: mockQuery,
  getConnection: jest.fn(),
}));

const ClubesModel = require('../models/clubes.model');

describe('ClubesModel.obtenerResumen', () => {
  const originalFetch = global.fetch;
  let obtenerEconomiaSpy;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-05-15T12:00:00Z'));
    mockQuery.mockReset();
    global.fetch = jest.fn();

    obtenerEconomiaSpy = jest.spyOn(ClubesModel, 'obtenerEconomia').mockResolvedValue({
      ingresos: { mes: { pagado: 800, senado: 200, pendiente_pago: 700 } },
      proyeccion: { mes: 1700 },
      gastos: { mes: 300 },
      economiaMensual: [
        { periodo: '2024-04', ingresos: { pagado: 200, senado: 0, pendiente_pago: 150 }, gastos: 100, balance: 100 },
        { periodo: '2024-05', ingresos: { pagado: 800, senado: 200, pendiente_pago: 700 }, gastos: 300, balance: 700 },
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    if (obtenerEconomiaSpy) obtenerEconomiaSpy.mockRestore();
  });

  it('should return aggregated club statistics with weather data', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ latitud: -34.6, longitud: -58.4 }]])
      .mockResolvedValueOnce([[{ estado: 'disponible', total: 5 }, { estado: 'mantenimiento', total: 1 }]])
      .mockResolvedValueOnce([[{ total: 7 }]])
      .mockResolvedValueOnce([[{ total: 10 }]])
      .mockResolvedValueOnce([[{ total: 1500 }]])
      .mockResolvedValueOnce([[{ etiqueta: 'Césped', total: 3 }]])
      .mockResolvedValueOnce([[{ pagadas: 4, finalizadas: 2 }]])
      .mockResolvedValueOnce([[{ fecha: new Date('2024-05-14'), total: 2, pagadas: 1, finalizadas: 0 }]])
      .mockResolvedValueOnce([[{ periodo: '2024-05', total: 12 }]]);

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ current: { temperature_2m: 23.7, weather_code: 1 } }),
    });

    const resumen = await ClubesModel.obtenerResumen(1);

    expect(resumen).toEqual({
      courtsAvailable: 5,
      courtsMaintenance: 1,
      courtsInactive: 0,
      reservasHoy: 7,
      reservasSemana: 10,
      economiaMes: 1500,
      courtTypes: [{ etiqueta: 'Césped', total: 3 }],
      reservasPagadasHoy: 4,
      reservasFinalizadasHoy: 2,
      reservasDiarias: [
        {
          fecha: '2024-05-14',
          finalizadas: 0,
          pagadas: 1,
          total: 2,
        },
      ],
      reservasMensuales: [{ periodo: '2024-05', total: 12 }],
      reservasMesActual: 12,
      weatherStatus: 'Mayormente despejado',
      weatherTemp: 24,
      ingresosMes: { pagado: 800, senado: 200, pendiente_pago: 700 },
      ingresosProyectadosMes: 1700,
      ingresosRealesMes: 1000,
      proyeccionMes: 1700,
      gastosMes: 300,
      economiaMensual: [
        { periodo: '2024-04', ingresos: { pagado: 200, senado: 0, pendiente_pago: 150 }, gastos: 100, balance: 100 },
        { periodo: '2024-05', ingresos: { pagado: 800, senado: 200, pendiente_pago: 700 }, gastos: 300, balance: 700 },
      ],
    });
  });
});

