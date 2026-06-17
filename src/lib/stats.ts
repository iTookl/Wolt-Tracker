import type { Shift } from '../types';
import { activeHours } from './time';

/**
 * Описательная статистика по слотам. Только средние по реальной истории —
 * никаких прогнозов. У каждого слота известно, на скольких сменах он основан,
 * чтобы честно подсветить «мало данных».
 */

export interface SlotStat {
  key: string;
  label: string;
  hint?: string;
  rate: number | null; // ₪/час, средневзвешенное по часам
  hours: number;
  earnings: number;
  shiftCount: number;
}

export interface StatsResult {
  byWeekday: SlotStat[];
  byTimeOfDay: SlotStat[];
  totalShifts: number; // сколько смён реально учтено (с заработком)
}

/** Порог, ниже которого слот считаем нестабильным. */
export const LOW_DATA_THRESHOLD = 3;

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; // getDay(): 0=Вс

interface TimeSlotDef {
  key: string;
  label: string;
  hint: string;
  hours: number[];
}

// Слоты из ТЗ. Ночь пересекает полночь — это нормально (часы 22..5).
const TIME_SLOTS: TimeSlotDef[] = [
  { key: 'morning', label: 'Утро', hint: '6–11', hours: [6, 7, 8, 9, 10] },
  { key: 'noon', label: 'Обед', hint: '11–15', hours: [11, 12, 13, 14] },
  { key: 'day', label: 'День', hint: '15–18', hours: [15, 16, 17] },
  { key: 'dinner', label: 'Ужин', hint: '18–22', hours: [18, 19, 20, 21] },
  { key: 'night', label: 'Ночь', hint: '22–6', hours: [22, 23, 0, 1, 2, 3, 4, 5] },
];

const HOUR_TO_SLOT = new Map<number, TimeSlotDef>();
for (const slot of TIME_SLOTS) {
  for (const h of slot.hours) HOUR_TO_SLOT.set(h, slot);
}

/** Минуты, проведённые в каждом часе суток (0..23) на интервале [start, end]. */
function hourBuckets(start: Date, end: Date): number[] {
  const buckets = new Array<number>(24).fill(0);
  let cur = start.getTime();
  const endMs = end.getTime();
  while (cur < endMs) {
    const d = new Date(cur);
    const hour = d.getHours();
    const boundary = new Date(d);
    boundary.setMinutes(0, 0, 0);
    boundary.setHours(hour + 1);
    const segEnd = Math.min(boundary.getTime(), endMs);
    buckets[hour] += (segEnd - cur) / 60000;
    cur = segEnd;
  }
  return buckets;
}

interface Acc {
  hours: number;
  earnings: number;
  shiftCount: number;
}

const finalize = (
  defs: { key: string; label: string; hint?: string }[],
  accs: Map<string, Acc>
): SlotStat[] =>
  defs.map((d) => {
    const a = accs.get(d.key) ?? { hours: 0, earnings: 0, shiftCount: 0 };
    return {
      key: d.key,
      label: d.label,
      hint: d.hint,
      hours: a.hours,
      earnings: a.earnings,
      shiftCount: a.shiftCount,
      rate: a.hours > 0 ? a.earnings / a.hours : null,
    };
  });

export function computeStats(shifts: Shift[]): StatsResult {
  const weekdayAcc = new Map<string, Acc>();
  const slotAcc = new Map<string, Acc>();
  const bump = (map: Map<string, Acc>, key: string, hours: number, earnings: number) => {
    const a = map.get(key) ?? { hours: 0, earnings: 0, shiftCount: 0 };
    a.hours += hours;
    a.earnings += earnings;
    a.shiftCount += 1;
    map.set(key, a);
  };

  let totalShifts = 0;

  for (const s of shifts) {
    if (s.status !== 'completed' || s.earnings == null || !s.endedAt) continue;
    const aHours = activeHours(s);
    if (aHours <= 0) continue;
    totalShifts += 1;

    const start = new Date(s.startedAt);
    const end = new Date(s.endedAt);

    // День недели: смену целиком относим к дню её начала.
    bump(weekdayAcc, WEEKDAYS[start.getDay()], aHours, s.earnings);

    // Время суток: длинная смена делится между слотами пропорционально
    // календарному времени в каждом часе (а чистые часы и заработок — по той же доле).
    const buckets = hourBuckets(start, end);
    const grossTotal = buckets.reduce((x, y) => x + y, 0);
    if (grossTotal <= 0) continue;

    const slotGross = new Map<string, number>();
    buckets.forEach((min, hour) => {
      if (min <= 0) return;
      const slot = HOUR_TO_SLOT.get(hour);
      if (slot) slotGross.set(slot.key, (slotGross.get(slot.key) ?? 0) + min);
    });

    for (const [key, gross] of slotGross) {
      const fraction = gross / grossTotal;
      bump(slotAcc, key, aHours * fraction, s.earnings * fraction);
    }
  }

  return {
    byWeekday: finalize(
      WEEKDAYS.map((label) => ({ key: label, label })),
      weekdayAcc
    ),
    byTimeOfDay: finalize(TIME_SLOTS, slotAcc),
    totalShifts,
  };
}
