import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import type { Shift } from '../types';
import { activeHours } from './time';
import { payWeekOf, shiftPayWeek } from './payout';

/**
 * Логика целей по заработку и авто-планировщик графика.
 *
 * Ключевые решения (согласованы с пользователем):
 *  - В прогресс идёт ТОЛЬКО база (`shift.earnings`), без чаевых.
 *  - Потолок 8 ч на день, работать можно в любой день недели.
 *  - Стратегия «максимум денег»: сильные дни грузим первыми на полный потолок,
 *    пока цель не закрыта; последний нужный день остаётся полным (допускаем
 *    перевыполнение, а не подрезаем часы).
 *  - Всё опирается на реальную историю; где данных по дню недели мало —
 *    честно помечаем и подмешиваем общий средний ₪/ч.
 */

export const MAX_HOURS_PER_DAY = 8;

/** Меньше этого числа отработанных дней по дню недели — данных мало. */
export const LOW_DATA_DAYS = 2;

// getDay(): 0=Вс … 6=Сб
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Учитываем смену в статистике базы только если есть введённый базовый заработок. */
function hasBase(s: Shift): boolean {
  return s.status === 'completed' && !!s.endedAt && s.earnings != null;
}

export interface WeekdayStat {
  weekday: number; // 0=Вс … 6=Сб
  label: string;
  ratePerHour: number | null; // ₪/ч по базе
  avgPerDay: number | null; // средняя база за отработанный день этого дня недели
  dayCount: number; // сколько таких дней реально отработано
  lowData: boolean; // данных мало — цифре пока не стоит доверять
}

/**
 * Статистика по дням недели (только база).
 * Сначала сворачиваем смены в календарные дни (на случай нескольких смен за день),
 * затем усредняем дни по дню недели.
 */
export function weekdayStats(shifts: Shift[]): WeekdayStat[] {
  const perDay = new Map<string, { weekday: number; base: number; hours: number }>();
  for (const s of shifts) {
    if (!hasBase(s)) continue;
    const h = activeHours(s);
    if (h <= 0) continue;
    const d = new Date(s.startedAt);
    const key = dayKey(d);
    const e = perDay.get(key) ?? { weekday: d.getDay(), base: 0, hours: 0 };
    e.base += s.earnings as number;
    e.hours += h;
    perDay.set(key, e);
  }

  const acc = new Map<number, { base: number; hours: number; days: number }>();
  for (const v of perDay.values()) {
    const a = acc.get(v.weekday) ?? { base: 0, hours: 0, days: 0 };
    a.base += v.base;
    a.hours += v.hours;
    a.days += 1;
    acc.set(v.weekday, a);
  }

  return WEEKDAYS.map((label, wd) => {
    const a = acc.get(wd);
    return {
      weekday: wd,
      label,
      ratePerHour: a && a.hours > 0 ? a.base / a.hours : null,
      avgPerDay: a && a.days > 0 ? a.base / a.days : null,
      dayCount: a?.days ?? 0,
      lowData: !a || a.days < LOW_DATA_DAYS,
    };
  });
}

/** Общий средний ₪/ч по базе — запасной ориентир для дней без своей статистики. */
export function overallBaseRate(shifts: Shift[]): number | null {
  let base = 0;
  let hours = 0;
  for (const s of shifts) {
    if (!hasBase(s)) continue;
    const h = activeHours(s);
    if (h <= 0) continue;
    base += s.earnings as number;
    hours += h;
  }
  return hours > 0 ? base / hours : null;
}

export type GoalPeriodKind = 'month' | 'week';

export interface GoalPeriod {
  kind: GoalPeriodKind;
  start: Date;
  end: Date;
}

/**
 * Период цели со сдвигом (0 = текущий, +1 = следующий и т.д.).
 * Месяц — календарный; неделя — расчётный период Wolt (Вт→Пн).
 * Положительный сдвиг позволяет заранее построить план на будущий месяц/неделю.
 */
export function periodByOffset(
  kind: GoalPeriodKind,
  offset: number,
  now: Date = new Date()
): GoalPeriod {
  if (kind === 'month') {
    const m = addMonths(now, offset);
    return { kind, start: startOfMonth(m), end: endOfMonth(m) };
  }
  const w = shiftPayWeek(payWeekOf(now), offset);
  return { kind, start: w.start, end: w.end };
}

/** Текущий период цели (сдвиг 0). */
export function currentPeriod(kind: GoalPeriodKind, now: Date = new Date()): GoalPeriod {
  return periodByOffset(kind, 0, now);
}

/** Сумма базы по смутам, попавшим в период. */
export function earnedBaseInPeriod(shifts: Shift[], period: GoalPeriod): number {
  const a = period.start.getTime();
  const b = period.end.getTime();
  return shifts.reduce((sum, s) => {
    if (s.status !== 'completed' || s.earnings == null) return sum;
    const t = new Date(s.startedAt).getTime();
    return t >= a && t <= b ? sum + s.earnings : sum;
  }, 0);
}

export interface PlannedDay {
  date: Date;
  weekday: number;
  label: string;
  hours: number;
  expected: number; // ожидаемая база за день, ₪
  ratePerHour: number;
  lowData: boolean;
}

export interface GoalPlan {
  target: number | null;
  earned: number; // база, уже заработанная в периоде
  remaining: number; // сколько ещё нужно (≥0)
  reached: boolean;
  progress: number; // 0..1

  // Темп относительно равномерного графика
  expectedByToday: number; // сколько «должно» быть к сегодняшнему дню при ровном темпе
  paceDelta: number; // earned − expectedByToday: + опережаешь, − отстаёшь

  // Рекомендованный график
  days: PlannedDay[]; // дни с часами > 0, в хронологическом порядке
  recommendedHours: number; // сумма часов по графику
  projectedEarnings: number; // earned + ожидание по графику
  feasible: boolean; // достижимо ли при потолке 8 ч на доступных днях
  shortfallHours: number; // не помещается часов (если недостижимо), по общему ₪/ч
  availableDayCount: number; // сколько ещё свободных дней до конца периода
  hasHistory: boolean; // есть ли вообще, на что опереться
}

/** Календарные дни, в которые уже есть завершённая смена (их не планируем). */
function workedDayKeys(shifts: Shift[]): Set<string> {
  const set = new Set<string>();
  for (const s of shifts) {
    if (s.status === 'completed') set.add(dayKey(new Date(s.startedAt)));
  }
  return set;
}

/**
 * Собрать план достижения цели на период.
 * Стратегия «максимум денег»: сортируем доступные дни по ₪/ч убыванию и грузим
 * по 8 ч, пока не закроем остаток; последний день остаётся полным.
 */
export function buildGoalPlan(
  shifts: Shift[],
  target: number | null,
  period: GoalPeriod,
  wstats: WeekdayStat[],
  overall: number | null,
  now: Date = new Date()
): GoalPlan {
  const earned = earnedBaseInPeriod(shifts, period);
  const hasHistory = overall != null;
  const remaining = target != null ? Math.max(0, target - earned) : 0;
  const reached = target != null && earned >= target;
  const progress = target != null && target > 0 ? Math.min(1, earned / target) : 0;

  // Темп: линейное ожидание к сегодняшнему дню.
  const totalDays = differenceInCalendarDays(period.end, period.start) + 1;
  const elapsedDays = Math.min(
    totalDays,
    Math.max(0, differenceInCalendarDays(now, period.start) + 1)
  );
  const expectedByToday =
    target != null ? (target * elapsedDays) / Math.max(1, totalDays) : 0;
  const paceDelta = target != null ? earned - expectedByToday : 0;

  // Доступные (ещё не отработанные) дни от сегодня до конца периода.
  const worked = workedDayKeys(shifts);
  const available: { date: Date; weekday: number; rate: number | null; low: boolean }[] = [];
  let cur = startOfDay(now.getTime() > period.start.getTime() ? now : period.start);
  while (cur.getTime() <= period.end.getTime()) {
    if (!worked.has(dayKey(cur))) {
      const wd = cur.getDay();
      const st = wstats[wd];
      available.push({
        date: new Date(cur),
        weekday: wd,
        rate: st.ratePerHour ?? overall,
        low: st.ratePerHour == null || st.lowData,
      });
    }
    cur = addDays(cur, 1);
  }

  const base: GoalPlan = {
    target,
    earned,
    remaining,
    reached,
    progress,
    expectedByToday,
    paceDelta,
    days: [],
    recommendedHours: 0,
    projectedEarnings: earned,
    feasible: true,
    shortfallHours: 0,
    availableDayCount: available.length,
    hasHistory,
  };

  if (overall == null || target == null || reached) return base;

  // Сильные дни первыми; при равной ставке — раньше по дате.
  const sorted = [...available]
    .filter((d) => d.rate != null && d.rate > 0)
    .sort((a, b) => b.rate! - a.rate! || a.date.getTime() - b.date.getTime());

  const chosen: PlannedDay[] = [];
  let acc = 0;
  for (const d of sorted) {
    if (acc >= remaining) break;
    const expected = MAX_HOURS_PER_DAY * d.rate!;
    chosen.push({
      date: d.date,
      weekday: d.weekday,
      label: WEEKDAYS[d.weekday],
      hours: MAX_HOURS_PER_DAY,
      expected,
      ratePerHour: d.rate!,
      lowData: d.low,
    });
    acc += expected;
  }

  chosen.sort((a, b) => a.date.getTime() - b.date.getTime());
  const feasible = acc >= remaining;
  const shortfallHours = feasible || overall <= 0 ? 0 : (remaining - acc) / overall;

  return {
    ...base,
    days: chosen,
    recommendedHours: chosen.reduce((s, d) => s + d.hours, 0),
    projectedEarnings: earned + acc,
    feasible,
    shortfallHours,
  };
}
