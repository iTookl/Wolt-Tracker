import type { BreakInterval, Shift } from '../types';

export const MS_PER_HOUR = 3_600_000;

/**
 * ★ ЯДРО ТОЧНОСТИ.
 * Всё время вычисляется из абсолютных timestamp'ов (startedAt / endedAt / breaks),
 * а НЕ накоплением тиков setInterval. Поэтому блокировка экрана, уход в фон
 * и перезагрузка приложения не влияют на точность — мы всегда считаем (now - start - паузы).
 */

const ms = (iso: string): number => new Date(iso).getTime();

/** Суммарная длительность пауз вплоть до момента `until` (мс). */
export function breaksMs(breaks: BreakInterval[], until: number): number {
  return breaks.reduce((sum, b) => {
    const start = ms(b.start);
    const rawEnd = b.end ? ms(b.end) : until; // открытая пауза «тикает» до now
    const end = Math.min(rawEnd, until);
    return sum + Math.max(0, end - start);
  }, 0);
}

/** Чистое рабочее время смены в миллисекундах (без пауз). */
export function activeMs(shift: Shift, now: number = Date.now()): number {
  const start = ms(shift.startedAt);
  const end = shift.endedAt ? ms(shift.endedAt) : now;
  return Math.max(0, end - start - breaksMs(shift.breaks, end));
}

export function activeHours(shift: Shift, now?: number): number {
  return activeMs(shift, now) / MS_PER_HOUR;
}

/** ₪/час. null, если нет заработка или нулевая длительность. */
export function ratePerHour(shift: Shift): number | null {
  if (shift.earnings == null) return null;
  const h = activeHours(shift);
  if (h <= 0) return null;
  return shift.earnings / h;
}

/** Идёт ли пауза прямо сейчас (последний интервал не закрыт). */
export function isPaused(shift: Shift): boolean {
  const last = shift.breaks[shift.breaks.length - 1];
  return !!last && last.end == null;
}

/** Длительность текущей паузы в мс (0, если не на паузе). */
export function currentBreakMs(shift: Shift, now: number = Date.now()): number {
  const last = shift.breaks[shift.breaks.length - 1];
  if (!last || last.end != null) return 0;
  return Math.max(0, now - ms(last.start));
}

/** "ЧЧ:ММ:СС" */
export function formatDuration(milliseconds: number): string {
  const totalSec = Math.floor(Math.max(0, milliseconds) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Короткий формат "5ч 23м" для списков. */
export function formatHm(milliseconds: number): string {
  const totalMin = Math.round(Math.max(0, milliseconds) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}м`;
  return `${h}ч ${m.toString().padStart(2, '0')}м`;
}
