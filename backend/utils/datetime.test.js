const test = require('node:test');
const assert = require('node:assert');
const { diaSemana1a7, addHoursHHMMSS, isPastDateTime } = require('./datetime');

test('diaSemana1a7 devuelve el día correcto', () => {
  assert.strictEqual(diaSemana1a7('2024-01-01'), 1);
  assert.strictEqual(diaSemana1a7('2024-01-07'), 7);
});

test('addHoursHHMMSS suma horas correctamente', () => {
  assert.strictEqual(addHoursHHMMSS('10:00:00', 2), '12:00:00');
  assert.strictEqual(addHoursHHMMSS('23:30:00', 2), '01:30:00');
});

test('isPastDateTime detecta si está en el pasado', () => {
  assert.strictEqual(isPastDateTime('2000-01-01', '00:00:00'), true);
  assert.strictEqual(isPastDateTime('2999-01-01', '00:00:00'), false);
});
