const { diaSemana1a7, addHoursHHMMSS, isPastDateTime } = require('./datetime');

describe('datetime utilities', () => {
  describe('diaSemana1a7', () => {
    it('devuelve el día correcto', () => {
      expect(diaSemana1a7('2024-01-01')).toBe(1);
      expect(diaSemana1a7('2024-01-07')).toBe(7);
    });
  });

  describe('addHoursHHMMSS', () => {
    it('suma horas correctamente', () => {
      expect(addHoursHHMMSS('10:00:00', 2)).toBe('12:00:00');
      expect(addHoursHHMMSS('23:30:00', 2)).toBe('01:30:00');
    });
  });

  describe('isPastDateTime', () => {
    it('detecta si está en el pasado', () => {
      expect(isPastDateTime('2000-01-01', '00:00:00')).toBe(true);
      expect(isPastDateTime('2999-01-01', '00:00:00')).toBe(false);
    });
  });
});
