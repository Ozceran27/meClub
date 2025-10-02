export const sanitizeTaxesForPayload = (taxes) => {
  if (!Array.isArray(taxes)) return [];
  return taxes.map((tax) => {
    const porcentaje = tax?.porcentaje ?? '';
    const normalized = Number(String(porcentaje).replace(',', '.'));
    const payload = {
      nombre: tax?.nombre ?? '',
      porcentaje: Number.isFinite(normalized) ? normalized : 0,
    };
    if (tax?.id && !String(tax.id).startsWith('tmp-')) {
      payload.id = tax.id;
    }
    return payload;
  });
};
