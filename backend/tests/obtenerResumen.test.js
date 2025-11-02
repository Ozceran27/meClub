jest.mock('../config/db', () => ({
  query: jest.fn(async (sql) => {
    if (sql.includes('FROM canchas')) {
      return [[{ total: 2 }]];
    }
    if (sql.includes('r.fecha = CURDATE()')) {
      return [[{ total: 3 }]];
    }
    if (sql.includes('YEARWEEK')) {
      return [[{ total: 4 }]];
    }
    if (sql.includes('COALESCE(SUM')) {
      return [[{ total: 100 }]];
    }
    return [[{ total: 0 }]];
  }),
  getConnection: jest.fn(),
}));

const ClubesModel = require('../models/clubes.model');

describe('ClubesModel.obtenerResumen', () => {
  it('should return aggregated club statistics', async () => {
    const resumen = await ClubesModel.obtenerResumen(1);

    expect(resumen).toEqual({
      courtsAvailable: 2,
      reservasHoy: 3,
      reservasSemana: 4,
      economiaMes: 100,
    });
  });
});

