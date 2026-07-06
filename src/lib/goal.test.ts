import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import type { PlannedShift, Shift } from '../types';
import {
  weekdayStats,
  overallBaseRate,
  cashMonthPeriod,
  buildMonthPlan,
  type WeekdayStat,
} from './goal';

let counter = 0;
function shift(startedAt: Date, endedAt: Date, total: number | null): Shift {
  return {
    id: `s${counter++}`,
    status: 'completed',
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    breaks: [],
    earnings: total,
    tips: null,
    deliveries: null,
    note: null,
  };
}

/** Равномерная статистика: у всех дней недели одинаковая ставка. */
function uniformWstats(rate: number): WeekdayStat[] {
  const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return labels.map((label, wd) => ({
    weekday: wd,
    label,
    ratePerHour: rate,
    avgPerDay: rate * 6,
    dayCount: 5,
    lowData: false,
  }));
}

const JULY = new Date(2026, 6, 1);

describe('weekdayStats / overallBaseRate', () => {
  it('относит смену к дню недели и считает ставку по итогу', () => {
    // 4 июл 2026 = суббота, 18–22 (4ч), 200 ⇒ 50 ₪/ч.
    const stats = weekdayStats([shift(new Date(2026, 6, 4, 18), new Date(2026, 6, 4, 22), 200)]);
    const sat = stats.find((s) => s.label === 'Сб')!;
    expect(sat.ratePerHour).toBeCloseTo(50, 6);
    expect(sat.avgPerDay).toBeCloseTo(200, 6);
    expect(sat.dayCount).toBe(1);
    expect(sat.lowData).toBe(true); // 1 день < порога
  });

  it('overallBaseRate = итог / часы', () => {
    expect(
      overallBaseRate([shift(new Date(2026, 6, 4, 18), new Date(2026, 6, 4, 22), 200)])
    ).toBeCloseTo(50, 6);
  });

  it('пустая история → null-ставки', () => {
    expect(overallBaseRate([])).toBeNull();
    expect(weekdayStats([]).every((s) => s.ratePerHour === null)).toBe(true);
  });
});

describe('cashMonthPeriod (июль 2026)', () => {
  const { weeks, start, end } = cashMonthPeriod(JULY);

  it('5 недель, чья выплата приходит в июле', () => {
    expect(weeks.length).toBe(5);
  });

  it('первая неделя Ср 24 июн → Вт 30 июн (выплата 1 июл), последняя кончается Вт 28 июл', () => {
    expect(format(weeks[0].start, 'yyyy-MM-dd')).toBe('2026-06-24');
    expect(format(weeks[0].paidOn, 'yyyy-MM-dd')).toBe('2026-07-01');
    expect(format(weeks[4].paidOn, 'yyyy-MM-dd')).toBe('2026-07-29');
    expect(format(new Date(start), 'yyyy-MM-dd')).toBe('2026-06-24');
    expect(format(new Date(end), 'yyyy-MM-dd')).toBe('2026-07-28');
  });

  it('все выплаты недель попадают в июль', () => {
    expect(weeks.every((w) => w.paidOn.getMonth() === 6)).toBe(true);
  });
});

describe('buildMonthPlan', () => {
  const wstats = uniformWstats(50);

  it('без истории (overall=null) график не строится', () => {
    const plan = buildMonthPlan([], [], 1000, JULY, uniformWstats(0).map((s) => ({ ...s, ratePerHour: null })), null, new Set());
    expect(plan.hasHistory).toBe(false);
    expect(plan.autoDays.length).toBe(0);
    expect(plan.restDays.length).toBe(0);
  });

  it('цель уже закрыта фактом → reached, весь остаток можно отдыхать', () => {
    const now = new Date(2026, 5, 24); // начало кассового периода
    const s = shift(new Date(2026, 5, 25, 18), new Date(2026, 5, 25, 22), 2000);
    const plan = buildMonthPlan([s], [], 1000, JULY, wstats, 50, new Set(), now);
    expect(plan.reached).toBe(true);
    expect(plan.progress).toBe(1);
    expect(plan.remaining).toBe(0);
    expect(plan.restDays.length).toBeGreaterThan(0);
  });

  it('строит короткий график под небольшую цель, остальное — дни отдыха', () => {
    // now близко к концу периода: доступны 26,27,28 июл (3 дня). Ставка 50, база 6ч.
    const now = new Date(2026, 6, 26);
    const plan = buildMonthPlan([], [], 300, JULY, wstats, 50, new Set(), now);
    expect(plan.workDays).toBe(1); // одного дня 6ч×50=300 хватает
    expect(plan.totalHours).toBe(6);
    expect(plan.autoDays[0].expected).toBeCloseTo(300, 6);
    expect(plan.feasible).toBe(true);
    expect(plan.restDays.length).toBe(2); // 2 свободных дня
    expect(plan.reached).toBe(false);
  });

  it('выходной день исключается из доступных под график', () => {
    const now = new Date(2026, 6, 26);
    const off = new Set(['2026-07-26']);
    const plan = buildMonthPlan([], [], 300, JULY, wstats, 50, off, now);
    // 26-е выходной ⇒ график встаёт на 27-е, свободным остаётся только 28-е.
    expect(plan.autoDays[0].dateKey).toBe('2026-07-27');
    expect(plan.restDays).toEqual(['2026-07-28']);
  });

  it('ручной план фиксирует день и учитывается в прогрессе', () => {
    const now = new Date(2026, 6, 26);
    const manual: PlannedShift = {
      id: 'p1',
      date: '2026-07-27',
      plannedStart: '18:00',
      plannedEnd: '23:00',
      targetEarnings: 250,
      auto: false,
    };
    const plan = buildMonthPlan([], [manual], 300, JULY, wstats, 50, new Set(), now);
    expect(plan.manualPlanned).toBeCloseTo(250, 6);
    // 27-е занято ручным планом — авто-график его не трогает.
    expect(plan.autoDays.every((d) => d.dateKey !== '2026-07-27')).toBe(true);
  });
});
