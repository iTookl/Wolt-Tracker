import {
  addDays,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import type { PlannedShift, Shift } from '../types';
import { activeHours, plannedRange, totalEarnings } from './time';
import { payWeekOf, shiftPayWeek, type PayWeek } from './payout';

/**
 * Логика целей по заработку и авто-планировщик графика.
 *
 * Ключевые решения (согласованы с пользователем):
 *  - В прогресс и ставки идёт база+чаевые (`totalEarnings`) — как показывает Wolt.
 *  - Стратегия «максимум денег»: сильные дни недели длиннее (ближе к PLAN_MAX_HOURS),
 *    слабые короче; остаток раскидывается на доступные дни.
 *  - Всё опирается на реальную историю; где данных по дню недели мало —
 *    честно помечаем и подмешиваем общий средний ₪/ч.
 */

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

// ─── Планировщик месяца (вкладка «План») ──────────────────────────────────────

/** Полоса длительности рекомендованной смены: часы «плавают» по ставке дня. */
export const PLAN_MIN_HOURS = 3;
export const PLAN_MAX_HOURS = 9;
/** Физический потолок часов в день при «догоняющем» графике под большую цель. */
export const PLAN_ABS_MAX_HOURS = 16;

const isoKey = (d: Date) => format(d, 'yyyy-MM-dd');

/** Подпись отрезка недели, пересечённого с месяцем: «29 июн–4 июл», «5–11 июл». */
function weekRangeLabel(a: Date, b: Date, locale: Locale = ru): string {
  if (a.getMonth() === b.getMonth()) {
    return `${format(a, 'd')}–${format(b, 'd MMM', { locale })}`;
  }
  return `${format(a, 'd MMM', { locale })} – ${format(b, 'd MMM', { locale })}`;
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
 * Кассовый месяц: набор недель Wolt, чья ВЫПЛАТА (`paidOn`) приходится на этот
 * календарный месяц. Так «июль» = деньги, полученные в июле; недели целые, без
 * обрезки по краям месяца (последняя неделя, платящаяся в августе, уедет в август,
 * а конец июня с выплатой 1 июля войдёт в июль).
 */
export function cashMonthPeriod(monthDate: Date): {
  weeks: PayWeek[];
  start: number;
  end: number;
} {
  const mStart = startOfMonth(monthDate).getTime();
  const mEnd = endOfMonth(monthDate).getTime();
  let w = payWeekOf(subDays(startOfMonth(monthDate), 14));
  while (w.paidOn.getTime() < mStart) w = shiftPayWeek(w, 1);
  const weeks: PayWeek[] = [];
  while (w.paidOn.getTime() <= mEnd) {
    weeks.push(w);
    w = shiftPayWeek(w, 1);
  }
  const start = weeks.length ? weeks[0].start.getTime() : mStart;
  const end = weeks.length ? weeks[weeks.length - 1].end.getTime() : mEnd;
  return { weeks, start, end };
}

/**
 * План на кассовый месяц (по приходу денег) под одну месячную цель.
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
  now: Date = new Date(),
  locale: Locale = ru
): MonthPlan {
  const { weeks: periodWeeks, start: periodStart, end: periodEnd } = cashMonthPeriod(monthDate);
  const inMonth = (t: number) => t >= periodStart && t <= periodEnd;
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

  // Доступные дни: от сегодня (или начала периода) до конца кассового периода.
  const available: { date: Date; key: string; wd: number; rate: number; low: boolean }[] = [];
  let cur = startOfDay(now.getTime() > periodStart ? now : new Date(periodStart));
  while (cur.getTime() <= periodEnd) {
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

  // Недельная разбивка = целые недели кассового месяца (по приходу денег), без обрезки.
  const weeks: WeekBucket[] = periodWeeks.map((pw) => {
    const cs = pw.start.getTime();
    const ce = pw.end.getTime();
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
    return {
      label: weekRangeLabel(pw.start, pw.end, locale),
      start: pw.start,
      end: pw.end,
      paidOn: pw.paidOn,
      planned: Math.round(plannedW),
      earned: Math.round(earnedW),
    };
  });

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
