/** Формат денег в шекелях, израильская локаль. */
export function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return `${value.toLocaleString('he-IL', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} ₪`;
}

/** ₪/час. Суффикс единицы зависит от языка: «₪/ч» (ru) / «₪/h» (en). */
export function formatRate(value: number | null, lang: 'ru' | 'en' = 'ru'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const unit = lang === 'en' ? '₪/h' : '₪/ч';
  return `${Math.round(value).toLocaleString('he-IL')} ${unit}`;
}
