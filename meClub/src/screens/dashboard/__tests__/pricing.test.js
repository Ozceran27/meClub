import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectHourlyPrice,
  calculateBaseAmount,
  determineRateType,
} from '../pricing.js';

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
