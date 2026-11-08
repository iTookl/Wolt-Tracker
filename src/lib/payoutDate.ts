import type { PayoutSettings } from '../types';
import { addCutoff, removeCutoff } from './payout';

/**
 * «Когда следующая выплата» — только ручной ввод.
 *
 * Пользователь вписывает дату из Wolt («Next payout after 15 jul»). Пока дата
 * не закончилась по времени Израиля — показываем её и сколько дней осталось.
 * С 00:00 следующего дня (Asia/Jerusalem) дата считается прошедшей → просим новую.
 *
 * Даты сравниваются как строки `YYYY-MM-DD` в TZ Asia/Jerusalem — без UTC-`Date`,
 * чтобы не было сдвига на день. Никаких «+7 дней»: дату не угадываем.
 *
 * Хранение — прежнее `PayoutSettings.cutoffs` (миграция не нужна): прошедшие
 * даты остаются историей для разбивки по периодам, следующая = ближайшая ≥ сегодня.
 */

export const ISRAEL_TZ = 'Asia/Jerusalem';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const israelFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ISRAEL_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Сегодняшняя дата в Израиле, `YYYY-MM-DD`. */
export function israelToday(now: Date = new Date()): string {
  const parts = israelFmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Корректная календарная дата `YYYY-MM-DD` (отсекает 2026-02-30 и т.п.). */
export function isValidDateKey(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Разница в календарных днях `to − from` (обе даты `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export type PayoutStatus =
  | { kind: 'unset' } // ни одной даты не вписано
  | { kind: 'upcoming'; date: string; daysLeft: number } // 0 = сегодня
  | { kind: 'passed'; date: string }; // последняя вписанная дата прошла — нужна новая

export function payoutStatus(cutoffs: string[], now: Date = new Date()): PayoutStatus {
  const today = israelToday(now);
  const list = [...new Set(cutoffs.filter(isValidDateKey))].sort();
  if (list.length === 0) return { kind: 'unset' };
  const next = list.find((c) => c >= today);
  if (next) return { kind: 'upcoming', date: next, daysLeft: daysBetween(today, next) };
  return { kind: 'passed', date: list[list.length - 1] };
}

export type PayoutDateError = 'empty' | 'invalid' | 'past';

/** Проверка вводимой даты: не пустая, корректная, не в прошлом (сегодня — можно). */
export function validatePayoutDate(
  value: string,
  now: Date = new Date()
): PayoutDateError | null {
  const v = value.trim();
  if (!v) return 'empty';
  if (!isValidDateKey(v)) return 'invalid';
  if (v < israelToday(now)) return 'past';
  return null;
}

/**
 * Сохранить дату следующей выплаты. Если уже вписана будущая дата — она
 * заменяется (это правка), иначе новая добавляется к истории. Невалидная дата
 * не сохраняется — возвращается тот же объект.
 */
export function saveNextPayout(
  cfg: PayoutSettings,
  value: string,
  now: Date = new Date()
): PayoutSettings {
  const v = value.trim();
  if (validatePayoutDate(v, now)) return cfg;
  const status = payoutStatus(cfg.cutoffs, now);
  const base = status.kind === 'upcoming' ? removeCutoff(cfg, status.date) : cfg;
  return addCutoff(base, v);
}
