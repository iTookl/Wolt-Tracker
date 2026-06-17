import type { BreakInterval, ISODate, Shift } from '../types';

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

/** Суммарный заработок = базовый + чаевые. null, если нигде ничего не введено. */
export function totalEarnings(shift: Shift): number | null {
  if (shift.earnings == null && shift.tips == null) return null;
  return (shift.earnings ?? 0) + (shift.tips ?? 0);
}

/** ₪/час по суммарному заработку. null, если нет заработка или нулевая длительность. */
export function ratePerHour(shift: Shift): number | null {
  const total = totalEarnings(shift);
  if (total == null) return null;
  const h = activeHours(shift);
  if (h <= 0) return null;
  return total / h;
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

/**
 * Периоды работы — обратная сторона модели start/end/breaks.
 * Перерыв = промежуток между соседними периодами. Это удобнее для ручного
 * ввода прошлых смен («работал 8:45–13:00, потом 19:00–21:30»).
 */
export interface WorkSegment {
  start: ISODate;
  end: ISODate;
}

/** Разложить смену на периоды работы (между перерывами). */
export function shiftToSegments(shift: Shift): WorkSegment[] {
  const segs: WorkSegment[] = [];
  let cursor = shift.startedAt;
  const sorted = [...shift.breaks]
    .filter((b) => b.end != null)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  for (const b of sorted) {
    segs.push({ start: cursor, end: b.start });
    cursor = b.end as string;
  }
  segs.push({ start: cursor, end: shift.endedAt ?? cursor });
  return segs;
}

/** Собрать обратно startedAt/endedAt/breaks из периодов работы. */
export function segmentsToTimes(segments: WorkSegment[]): {
  startedAt: ISODate;
  endedAt: ISODate;
  breaks: BreakInterval[];
} {
  const sorted = [...segments].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  const breaks: BreakInterval[] = [];
  for (let i = 1; i < sorted.length; i++) {
    breaks.push({ start: sorted[i - 1].end, end: sorted[i].start });
  }
  return {
    startedAt: sorted[0].start,
    endedAt: sorted[sorted.length - 1].end,
    breaks,
  };
}

/** Чистое время по периодам (сумма длительностей). */
export function segmentsActiveMs(segments: WorkSegment[]): number {
  return segments.reduce(
    (sum, s) => sum + Math.max(0, new Date(s.end).getTime() - new Date(s.start).getTime()),
    0
  );
}

/** Короткий формат "5ч 23м" для списков. */
export function formatHm(milliseconds: number): string {
  const totalMin = Math.round(Math.max(0, milliseconds) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}м`;
  return `${h}ч ${m.toString().padStart(2, '0')}м`;
}
