/** Формат денег в шекелях, израильская локаль. */
export function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return `${value.toLocaleString('he-IL', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} ₪`;
}

/** ₪/час. */
export function formatRate(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('he-IL')} ₪/ч`;
}
