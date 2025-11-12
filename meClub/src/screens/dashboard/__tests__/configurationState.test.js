import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS,
  buildFormState,
  denormalizeSchedule,
  normalizeSchedule,
  normalizeTimeToHHMM,
} from '../configurationState.js';

const sampleSchedule = [
  { dia_semana: 1, abre: '08:00', cierra: '12:00', activo: true },
  { dia: 'tuesday', horarios: [{ start: '09:00', end: '18:00' }] },
];

test('buildFormState normalizes schedule arrays from the API', () => {
  const formState = buildFormState({ horarios: sampleSchedule });

  assert.ok(formState.horarios);
  assert.equal(typeof formState.horarios, 'object');
  assert.ok(formState.horarios.monday.enabled);
  assert.deepEqual(formState.horarios.monday.ranges, [{ start: '08:00', end: '12:00' }]);
  assert.ok(formState.horarios.tuesday.enabled);
  assert.deepEqual(formState.horarios.tuesday.ranges, [{ start: '09:00', end: '18:00' }]);

  for (const day of DAYS.slice(2)) {
    assert.deepEqual(formState.horarios[day.key], { enabled: false, ranges: [] });
  }
});

test('buildFormState preserves normalized schedule objects across reloads', () => {
  const firstState = buildFormState({ horarios: sampleSchedule });
  const normalizedSchedule = firstState.horarios;
  const payload = denormalizeSchedule(normalizedSchedule);

  const reloadedState = buildFormState({ horarios: normalizedSchedule });

  assert.strictEqual(reloadedState.horarios, normalizedSchedule);
  assert.deepEqual(denormalizeSchedule(reloadedState.horarios), payload);
  assert.deepEqual(normalizeSchedule(payload), normalizedSchedule);
});

test('buildFormState normalizes night tariff hours to HH:MM', () => {
  const state = buildFormState({
    hora_nocturna_inicio: '22:15:30',
    hora_nocturna_fin: '06:00',
  });

  assert.equal(state.hora_nocturna_inicio, '22:15');
  assert.equal(state.hora_nocturna_fin, '06:00');
  assert.equal(normalizeTimeToHHMM('5:7'), '05:07');
  assert.equal(normalizeTimeToHHMM('invalid'), '');
});
