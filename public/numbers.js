const plnFormatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });

export function parseDecimal(value) {
  const text = String(value ?? '').trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const amount = Number(text.replace(',', '.'));
  return Number.isFinite(amount) ? amount : null;
}

export function formatPrice(value) {
  const amount = parseDecimal(value);
  return amount === null ? (value ?? '') : plnFormatter.format(amount);
}
