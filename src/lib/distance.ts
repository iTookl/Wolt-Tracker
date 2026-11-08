import type { Shift } from '../types';
import { totalEarnings } from './time';

/**
 * Километры и ₪/км.
 *
 * Wolt показывает км только по заказам — пустые перегоны (переезд в другой район
 * без заказа) туда не входят. Поэтому у смены два опциональных поля:
 *  - `woltKm`   — км по приложению Wolt;
 *  - `actualKm` — реальный пробег (одометр или своя оценка) — ГЛАВНАЯ метрика.
 * «Пустой пробег» = actualKm − woltKm.
 *
 * Заработок — база + чаевые (`totalEarnings`), как и в ₪/ч.
 * Смены без км в ₪/км-статистике не участвуют.
 */

/** Положительное конечное число или null (для чтения из storage/импорта). */
export function cleanKm(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Разбор ввода: «44.7», «44,7»; пусто/мусор/отрицательное → null. */
export function parseKm(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (s === '') return null;
  return cleanKm(Number(s));
}

/** Пробег по одометру: конец − начало. Нет значения или конец < начала → null. */
export function odometerDistance(start: number | null, end: number | null): number | null {
  if (start == null || end == null || end < start) return null;
  return Math.round((end - start) * 10) / 10; // одометр — до 0.1 км, убираем шум float
}

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export interface ShiftKmMetrics {
  woltKm: number | null;
  actualKm: number | null;
  perWoltKm: number | null; // ₪/км по Wolt
  perActualKm: number | null; // ₪/км по реальному пробегу — главная
  emptyKm: number | null; // пустой пробег, км
  emptyPct: number | null; // пустой пробег, % от реального
}

export function shiftKm(shift: Shift): ShiftKmMetrics {
  const woltKm = cleanKm(shift.woltKm);
  const actualKm = cleanKm(shift.actualKm);
  const money = totalEarnings(shift);
  const emptyKm = woltKm != null && actualKm != null ? actualKm - woltKm : null;
  return {
    woltKm,
    actualKm,
    perWoltKm: money != null && woltKm != null ? ratio(money, woltKm) : null,
    perActualKm: money != null && actualKm != null ? ratio(money, actualKm) : null,
    emptyKm,
    emptyPct: emptyKm != null && actualKm != null ? pct(ratio(emptyKm, actualKm)) : null,
  };
}

const pct = (r: number | null) => (r == null ? null : r * 100);

export interface KmAggregate {
  perWoltKm: number | null;
  perActualKm: number | null;
  emptyKm: number | null; // сумма по сменам, где есть оба значения
  emptyPct: number | null;
  totalWoltKm: number;
  totalActualKm: number;
  woltShifts: number; // сколько смен участвует в ₪/км по Wolt
  actualShifts: number; // … по реальному пробегу
}

/** Сводка за период: Σ заработка / Σ км (взвешенно), а не среднее от средних. */
export function aggregateKm(shifts: Shift[]): KmAggregate {
  let woltMoney = 0;
  let woltKm = 0;
  let woltShifts = 0;
  let actualMoney = 0;
  let actualKm = 0;
  let actualShifts = 0;
  let bothWolt = 0;
  let bothActual = 0;
  let bothShifts = 0;

  for (const s of shifts) {
    const money = totalEarnings(s);
    const w = cleanKm(s.woltKm);
    const a = cleanKm(s.actualKm);
    if (money != null && w != null && w > 0) {
      woltMoney += money;
      woltKm += w;
      woltShifts++;
    }
    if (money != null && a != null && a > 0) {
      actualMoney += money;
      actualKm += a;
      actualShifts++;
    }
    if (w != null && a != null && a > 0) {
      bothWolt += w;
      bothActual += a;
      bothShifts++;
    }
  }

  const emptyKm = bothShifts > 0 ? bothActual - bothWolt : null;
  return {
    perWoltKm: ratio(woltMoney, woltKm),
    perActualKm: ratio(actualMoney, actualKm),
    emptyKm,
    emptyPct: emptyKm != null ? pct(ratio(emptyKm, bothActual)) : null,
    totalWoltKm: woltKm,
    totalActualKm: actualKm,
    woltShifts,
    actualShifts,
  };
}

/** Черновик полей км в форме смены (строки как в инпутах). */
export interface KmDraft {
  wolt: string;
  mode: 'number' | 'odometer'; // реальный пробег: одно число или одометр начало/конец
  actual: string;
  odoStart: string;
  odoEnd: string;
}

export function kmDraftFrom(shift: Pick<Shift, 'woltKm' | 'actualKm'>): KmDraft {
  return {
    wolt: shift.woltKm != null ? String(shift.woltKm) : '',
    mode: 'number',
    actual: shift.actualKm != null ? String(shift.actualKm) : '',
    odoStart: '',
    odoEnd: '',
  };
}

export interface KmDraftResult {
  woltKm: number | null;
  actualKm: number | null;
  odometerError: boolean; // введены оба показания, но конец меньше начала
}

export function kmFromDraft(d: KmDraft): KmDraftResult {
  const woltKm = parseKm(d.wolt);
  if (d.mode === 'number') return { woltKm, actualKm: parseKm(d.actual), odometerError: false };
  const start = parseKm(d.odoStart);
  const end = parseKm(d.odoEnd);
  return {
    woltKm,
    actualKm: odometerDistance(start, end),
    odometerError: start != null && end != null && end < start,
  };
}
