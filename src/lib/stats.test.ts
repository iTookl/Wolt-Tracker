import { describe, it, expect } from 'vitest';
import type { Shift } from '../types';
import { computeStats } from './stats';

let counter = 0;
function shift(
  startedAt: Date,
  endedAt: Date,
  earnings: number | null,
  tips: number | null = null
): Shift {
  return {
    id: `s${counter++}`,
    status: 'completed',
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    breaks: [],
    earnings,
    tips,
    deliveries: null,
    note: null,
  };
}

const at = (day: number, h: number, m = 0) => new Date(2026, 6, day, h, m);
const slot = (r: ReturnType<typeof computeStats>['byTimeOfDay'], key: string) =>
  r.find((s) => s.key === key)!;

describe('computeStats', () => {
  it('считает overallRate и totalShifts по итогу (база+чаевые)', () => {
    // 4 июл 18:00–22:00, 4ч, 180+20=200 ⇒ 50 ₪/ч
    const r = computeStats([shift(at(4, 18), at(4, 22), 180, 20)]);
    expect(r.totalShifts).toBe(1);
    expect(r.overallRate).toBeCloseTo(50, 6);
  });

  it('смену целиком относит к дню недели её начала', () => {
    // 4 июл 2026 = суббота (getDay 6 ⇒ «Сб»).
    const r = computeStats([shift(at(4, 18), at(4, 22), 200)]);
    const sat = r.byWeekday.find((w) => w.label === 'Сб')!;
    expect(sat.shiftCount).toBe(1);
    expect(sat.hours).toBeCloseTo(4, 6);
    expect(sat.earnings).toBe(200);
  });

  it('делит длинную смену между слотами пропорционально часам', () => {
    // 17:00–19:00: час в слоте «День» (17), час в «Ужин» (18). Итог 100 за 2ч.
    const r = computeStats([shift(at(4, 17), at(4, 19), 100)]);
    const day = slot(r.byTimeOfDay, 'day');
    const dinner = slot(r.byTimeOfDay, 'dinner');
    expect(day.hours).toBeCloseTo(1, 6);
    expect(day.earnings).toBeCloseTo(50, 6);
    expect(dinner.hours).toBeCloseTo(1, 6);
    expect(dinner.earnings).toBeCloseTo(50, 6);
  });

  it('слот «Ночь» пересекает полночь', () => {
    // 23:00–01:00: час в 23 и час в 0 — оба слот «Ночь».
    const r = computeStats([shift(at(4, 23), at(5, 1), 80)]);
    const night = slot(r.byTimeOfDay, 'night');
    expect(night.hours).toBeCloseTo(2, 6);
    expect(night.earnings).toBeCloseTo(80, 6);
  });

  it('игнорирует смены без заработка и с нулевой длительностью', () => {
    const r = computeStats([
      shift(at(4, 18), at(4, 22), null), // нет заработка
      shift(at(4, 18), at(4, 18), 100), // нулевая длительность
    ]);
    expect(r.totalShifts).toBe(0);
    expect(r.overallRate).toBeNull();
  });

  it('пустая история — нулевые слоты, overallRate=null', () => {
    const r = computeStats([]);
    expect(r.totalShifts).toBe(0);
    expect(r.overallRate).toBeNull();
    expect(r.byTimeOfDay.every((s) => s.rate === null)).toBe(true);
  });
});
