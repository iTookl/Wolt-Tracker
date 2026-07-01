import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import type { PlannedShift, Shift } from '../types';
import { activeHours, plannedRange, totalEarnings } from './time';
import { newId } from './id';
import { payWeekOf, shiftPayWeek } from './payout';

/**
 * Логика целей по заработку и авто-планировщик графика.
 *
 * Ключевые решения (согласованы с пользователем):
 *  - В прогресс и ставки идёт база+чаевые (`totalEarnings`) — как показывает Wolt.
 *  - Потолок 6 ч на день (`MAX_HOURS_PER_DAY`), работать можно в любой день недели.
 *  - Стратегия «максимум денег»: сильные дни грузим первыми на полный потолок,
 *    пока цель не закрыта; последний нужный день остаётся полным (допускаем
 *    перевыполнение, а не подрезаем часы).
 *  - Всё опирается на реальную историю; где данных по дню недели мало —
 *    честно помечаем и подмешиваем общий средний ₪/ч.
 */

export const MAX_HOURS_PER_DAY = 6;

/** Меньше этого числа отработанных дней по дню недели — данных мало. */
export const LOW_DATA_DAYS = 2;

// getDay(): 0=Вс … 6=Сб
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Учитываем смену, если есть введённый заработок (база и/или чаевые). */
function hasBase(s: Shift): boolean {
  return s.status === 'completed' && !!s.endedAt && totalEarnings(s) != null;
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
    e.base += totalEarnings(s) ?? 0;
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
    base += totalEarnings(s) ?? 0;
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
  feasible: boolean; // достижимо ли при потолке MAX_HOURS_PER_DAY на доступных днях
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
 * по MAX_HOURS_PER_DAY ч, пока не закроем остаток; последний день остаётся полным.
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

const pad2 = (n: number) => n.toString().padStart(2, '0');

/**
 * Материализует рекомендованный график (`GoalPlan.days`) в плановые смены (`auto:true`).
 * Старт у всех — `startHour` (лучший слот по истории), длительность = часы дня.
 * Если день уже занят (есть смена/ручной план) — фильтруется снаружи.
 */
export function autoPlansFromDays(days: PlannedDay[], startHour: number): PlannedShift[] {
  return days.map((d) => {
    const hours = Math.round(d.hours);
    const endHour = (startHour + hours) % 24; // конец ≤ старта ⇒ смена уходит за полночь
    return {
      id: newId(),
      date: format(d.date, 'yyyy-MM-dd'),
      plannedStart: `${pad2(startHour)}:00`,
      plannedEnd: `${pad2(endHour)}:00`,
      targetEarnings: Math.round(d.expected),
      auto: true,
    };
  });
}

// ─── Планировщик месяца (новая вкладка «План») ────────────────────────────────

/** Полоса длительности рекомендованной смены: часы «плавают» по ставке дня. */
export const PLAN_MIN_HOURS = 3;
export const PLAN_MAX_HOURS = 9;
/** Физический потолок часов в день при «догоняющем» графике под большую цель. */
export const PLAN_ABS_MAX_HOURS = 16;

const isoKey = (d: Date) => format(d, 'yyyy-MM-dd');

/** Подпись отрезка недели, пересечённого с месяцем: «29 июн–4 июл», «5–11 июл». */
function weekRangeLabel(a: Date, b: Date): string {
  if (a.getMonth() === b.getMonth()) {
    return `${format(a, 'd')}–${format(b, 'd MMM', { locale: ru })}`;
  }
  return `${format(a, 'd MMM', { locale: ru })} – ${format(b, 'd MMM', { locale: ru })}`;
}

export interface MonthPlanDay {
  dateKey: string;
  date: Date;
  weekday: number;
  hours: number; // рекомендованная длительность (переменная по ставке)
  expected: number; // ожидаемая база за день
  ratePerHour: number;
  lowData: boolean;
}

export interface WeekBucket {
  label: string;
  start: Date; // край, обрезанный по месяцу
  end: Date;
  paidOn: Date; // среда — когда придут деньги за эту расчётную неделю Wolt
  planned: number; // авто + ручные планы недели, ₪
  earned: number; // факт по базе за неделю, ₪
}

export interface MonthPlan {
  target: number | null;
  earned: number; // база, заработанная в месяце
  manualPlanned: number; // ожидание по ручным планам (будущие дни месяца)
  remaining: number; // сколько ещё раскидать авто-планом (≥0)
  reached: boolean;
  progress: number; // 0..1
  perWeekNeed: number; // остаток ÷ оставшиеся недели
  weeksLeft: number;
  autoDays: MonthPlanDay[]; // рекомендованные дни (хронологически)
  autoByDay: Map<string, MonthPlanDay>;
  restDays: string[]; // свободные дни: доступны, но под цель не нужны — можно отдыхать
  totalHours: number; // сколько всего часов нужно отработать по графику
  workDays: number; // в скольких днях
  feasible: boolean; // помещается ли остаток даже при потолке PLAN_ABS_MAX_HOURS
  shortfallHours: number;
  weeks: WeekBucket[];
  hasHistory: boolean;
}

/**
 * План на календарный месяц под одну месячную цель.
 * Стратегия «максимум денег» с ПЕРЕМЕННЫМИ часами: сильные дни недели длиннее
 * (ближе к PLAN_MAX_HOURS), слабые короче (к PLAN_MIN_HOURS). Дни отработанные,
 * с ручным планом и помеченные выходными — из авто-распределения исключаются.
 */
export function buildMonthPlan(
  shifts: Shift[],
  planned: PlannedShift[],
  target: number | null,
  monthDate: Date,
  wstats: WeekdayStat[],
  overall: number | null,
  offDays: Set<string>,
  now: Date = new Date()
): MonthPlan {
  const monthStart = startOfMonth(monthDate).getTime();
  const monthEnd = endOfMonth(monthDate).getTime();
  const inMonth = (t: number) => t >= monthStart && t <= monthEnd;
  const todayStart = startOfDay(now).getTime();
  const rateFor = (wd: number) => wstats[wd]?.ratePerHour ?? overall ?? 0;

  // Факт по базе и отработанные дни.
  let earned = 0;
  const workedDays = new Set<string>();
  for (const s of shifts) {
    if (s.status !== 'completed') continue;
    const t = new Date(s.startedAt).getTime();
    if (!inMonth(t)) continue;
    workedDays.add(isoKey(new Date(s.startedAt)));
    earned += totalEarnings(s) ?? 0;
  }

  // Ручные планы месяца (не авто).
  const manualExpectedByDay = new Map<string, number>();
  const manualDays = new Set<string>();
  let manualPlanned = 0;
  for (const p of planned) {
    if (p.auto) continue;
    const t = new Date(`${p.date}T00:00`).getTime();
    if (!inMonth(t)) continue;
    manualDays.add(p.date);
    let exp = p.targetEarnings ?? 0;
    if (exp <= 0) {
      const { start, end } = plannedRange(p.date, p.plannedStart, p.plannedEnd);
      const hrs = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
      exp = hrs * rateFor(new Date(t).getDay());
    }
    manualExpectedByDay.set(p.date, (manualExpectedByDay.get(p.date) ?? 0) + exp);
    if (t >= todayStart && !workedDays.has(p.date)) manualPlanned += exp;
  }

  const committed = earned + manualPlanned;
  const remaining = target != null ? Math.max(0, target - committed) : 0;
  const reached = target != null && committed >= target;
  const progress = target != null && target > 0 ? Math.min(1, committed / target) : 0;
  const hasHistory = overall != null;

  // Доступные дни: от сегодня (или начала месяца) до конца месяца.
  const available: { date: Date; key: string; wd: number; rate: number; low: boolean }[] = [];
  let cur = startOfDay(now.getTime() > monthStart ? now : new Date(monthStart));
  while (cur.getTime() <= monthEnd) {
    const key = isoKey(cur);
    if (!workedDays.has(key) && !manualDays.has(key) && !offDays.has(key)) {
      const wd = cur.getDay();
      const st = wstats[wd];
      const rate = st?.ratePerHour ?? overall ?? 0;
      if (rate > 0) {
        available.push({
          date: new Date(cur),
          key,
          wd,
          rate,
          low: !st || st.ratePerHour == null || st.lowData,
        });
      }
    }
    cur = addDays(cur, 1);
  }

  // Переменные часы: линейно от ставки в полосу [MIN, MAX].
  const rates = available.map((a) => a.rate);
  const rMin = rates.length ? Math.min(...rates) : 0;
  const rMax = rates.length ? Math.max(...rates) : 0;
  const hoursForRate = (rate: number): number => {
    if (rMax <= rMin) return Math.round((PLAN_MIN_HOURS + PLAN_MAX_HOURS) / 2);
    const norm = (rate - rMin) / (rMax - rMin);
    return Math.round(PLAN_MIN_HOURS + (PLAN_MAX_HOURS - PLAN_MIN_HOURS) * norm);
  };

  const sorted = [...available].sort(
    (a, b) => b.rate - a.rate || a.date.getTime() - b.date.getTime()
  );
  type AvailDay = { date: Date; key: string; wd: number; rate: number; low: boolean };
  const autoDays: MonthPlanDay[] = [];
  let acc = 0;
  const push = (d: AvailDay, hours: number) => {
    autoDays.push({
      dateKey: d.key,
      date: d.date,
      weekday: d.wd,
      hours,
      expected: hours * d.rate,
      ratePerHour: d.rate,
      lowData: d.low,
    });
    acc += hours * d.rate;
  };

  if (target != null && !reached && hasHistory && sorted.length > 0) {
    const withBase = sorted.map((d) => ({ d, baseHours: Math.max(1, hoursForRate(d.rate)) }));
    const baseTotal = withBase.reduce((s, x) => s + x.baseHours * x.d.rate, 0);

    if (baseTotal >= remaining) {
      // Комфортно: сильные дни по полосе часов, пока не закроем; последний подрезаем.
      for (const { d, baseHours } of withBase) {
        if (acc >= remaining) break;
        let hours = baseHours;
        if (acc + hours * d.rate > remaining) {
          hours = Math.min(hours, Math.max(1, Math.ceil((remaining - acc) / d.rate)));
        }
        push(d, hours);
      }
    } else {
      // Полосы мало под такую цель — «догоняем»: поднимаем часы на ВСЕХ доступных
      // днях пропорционально (сильные дни всё равно длиннее), до физического потолка.
      const factor = remaining / baseTotal;
      for (const { d, baseHours } of withBase) {
        const hours = Math.min(
          PLAN_ABS_MAX_HOURS,
          Math.max(1, Math.round(baseHours * factor))
        );
        push(d, hours);
      }
    }
  }
  autoDays.sort((a, b) => a.date.getTime() - b.date.getTime());
  const totalHours = autoDays.reduce((s, d) => s + d.hours, 0);
  const workDays = autoDays.length;
  const feasible = target == null || reached || acc >= remaining;
  const shortfallHours =
    feasible || overall == null || overall <= 0 ? 0 : (remaining - acc) / overall;
  const autoByDay = new Map(autoDays.map((d) => [d.dateKey, d] as const));

  // Свободные дни: доступные, которые график под цель НЕ занял (ты в графике/с
  // опережением). Если цель закрыта — свободен весь остаток месяца.
  const restDays =
    target != null && hasHistory
      ? available.filter((a) => !autoByDay.has(a.key)).map((a) => a.key)
      : [];

  // Недельная разбивка по расчётным неделям Wolt (Вт→Пн, до выплаты), обрезанная по месяцу.
  const weeks: WeekBucket[] = [];
  let w = payWeekOf(new Date(monthStart));
  while (w.start.getTime() <= monthEnd) {
    const cs = Math.max(w.start.getTime(), monthStart);
    const ce = Math.min(w.end.getTime(), monthEnd);
    if (cs <= ce) {
      let plannedW = 0;
      for (const d of autoDays) {
        const t = d.date.getTime();
        if (t >= cs && t <= ce) plannedW += d.expected;
      }
      for (const [k, exp] of manualExpectedByDay) {
        const t = new Date(`${k}T00:00`).getTime();
        if (t >= cs && t <= ce) plannedW += exp;
      }
      let earnedW = 0;
      for (const s of shifts) {
        if (s.status !== 'completed') continue;
        const e = totalEarnings(s);
        if (e == null) continue;
        const t = new Date(s.startedAt).getTime();
        if (t >= cs && t <= ce) earnedW += e;
      }
      weeks.push({
        label: weekRangeLabel(new Date(cs), new Date(ce)),
        start: new Date(cs),
        end: new Date(ce),
        paidOn: w.paidOn,
        planned: Math.round(plannedW),
        earned: Math.round(earnedW),
      });
    }
    w = shiftPayWeek(w, 1);
  }

  const weeksLeft = Math.max(1, weeks.filter((w) => w.end.getTime() >= todayStart).length);
  const perWeekNeed = target != null ? Math.round(remaining / weeksLeft) : 0;

  return {
    target,
    earned,
    manualPlanned,
    remaining,
    reached,
    progress,
    perWeekNeed,
    weeksLeft,
    autoDays,
    autoByDay,
    restDays,
    totalHours,
    workDays,
    feasible,
    shortfallHours,
    weeks,
    hasHistory,
  };
}
