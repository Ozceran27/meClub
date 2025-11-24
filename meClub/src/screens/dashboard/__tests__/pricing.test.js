const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectHourlyPrice,
  calculateBaseAmount,
  determineRateType,
  findApplicableTariff,
} = require('../pricing.js');

const clubWithNightHours = {
  hora_nocturna_inicio: '22:00',
  hora_nocturna_fin: '06:00',
};

test('selectHourlyPrice returns custom tariff when provided', () => {
  const cancha = { precioDia: 2500, precioNoche: 3200 };
  const tarifa = { precio: 1800 };
  const result = selectHourlyPrice({ cancha, club: clubWithNightHours, horaInicio: '10:00', tarifa });
  assert.equal(result, 1800);
});

test('selectHourlyPrice picks night price when start is within night range', () => {
  const cancha = { precioDia: 2000, precioNoche: 2800 };
  const nightResult = selectHourlyPrice({ cancha, club: clubWithNightHours, horaInicio: '23:15' });
  const dayResult = selectHourlyPrice({ cancha, club: clubWithNightHours, horaInicio: '15:00' });

  assert.equal(nightResult, 2800);
  assert.equal(dayResult, 2000);
});

test('calculateBaseAmount multiplies hourly rate by duration', () => {
  const cancha = { precioDia: 1500, precioNoche: 2100 };
  const amount = calculateBaseAmount({
    cancha,
    club: clubWithNightHours,
    horaInicio: '23:00',
    duracionHoras: 2,
  });

  assert.equal(amount, 4200);
});

test('determineRateType returns night when the time falls in the configured range', () => {
  const rate = determineRateType({ horaInicio: '01:30', club: clubWithNightHours });
  assert.equal(rate, 'night');

  const dayRate = determineRateType({ horaInicio: '12:00', club: clubWithNightHours });
  assert.equal(dayRate, 'day');
});

test('findApplicableTariff matches by día y rango completo', () => {
  const tarifas = [
    { tarifa_id: 1, dia_semana: 3, hora_desde: '08:00:00', hora_hasta: '12:00:00', precio: 1200 },
    { tarifa_id: 2, dia_semana: 3, hora_desde: '09:00:00', hora_hasta: '15:00:00', precio: 1500 },
    { tarifa_id: 3, dia_semana: 4, hora_desde: '10:00:00', hora_hasta: '18:00:00', precio: 2000 },
  ];

  const aplicable = findApplicableTariff({
    tarifas,
    diaSemana: 3,
    horaInicio: '10:00:00',
    horaFin: '12:00:00',
  });

  assert.equal(aplicable?.tarifa_id, 2);
  assert.equal(aplicable?.precio, 1500);
});
