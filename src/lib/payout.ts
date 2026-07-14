import {
  addDays,
  endOfDay,
  format,
  isTuesday,
  nextTuesday,
  startOfDay,
  subDays,
  type Locale,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import type { PayoutSettings } from '../types';

/**
 * Расчётный период выплаты Wolt.
 *
 * Wolt показывает «Next payout after 15 jul» — это КОНЕЦ расчётного периода
 * (`cutoff`). Деньги приходят вскоре после него. Точного дня прихода мы не знаем,
 * поэтому даты периодов пользователь вписывает руками (`PayoutSettings.cutoffs`),
 * а `paidOn` считаем как «на следующий день после конца» — этого достаточно, чтобы
 * отнести период к кассовому месяцу.
 *
 * Как строится сетка периодов:
 *  - введённые даты — авторитетные границы: период = (предыдущая дата, следующая];
 *  - вне диапазона введённых дат сетка достраивается шагом `cadenceDays` (обычно 7);
 *  - пока не введено ни одной даты — дефолт: недельная сетка с концом во вторник
 *    (старое поведение приложения), чтобы экраны работали до первой настройки.
 */

export const DEFAULT_CADENCE_DAYS = 7;

/** Через сколько дней после конца периода считаем деньги пришедшими. */
export const PAYOUT_DELAY_DAYS = 1;

export const defaultPayoutSettings = (): PayoutSettings => ({
  cutoffs: [],
  cadenceDays: DEFAULT_CADENCE_DAYS,
});

export interface PayPeriod {
  start: Date; // первый день периода, 00:00 (включительно)
  end: Date; // конец периода (cutoff), 23:59:59 — «payout after этой даты»
  paidOn: Date; // ориентировочный день прихода денег (конец + PAYOUT_DELAY_DAYS)
}

/** Заданы ли реальные даты выплат (иначе работает дефолтная сетка). */
export function hasPayoutSetup(cfg: PayoutSettings): boolean {
  return cfg.cutoffs.length > 0;
}

/** Введённые даты как отсортированные уникальные полуночи. */
function anchors(cfg: PayoutSettings): Date[] {
  const seen = new Set<string>();
  return cfg.cutoffs
    .filter((c) => (seen.has(c) ? false : (seen.add(c), true)))
    .map((c) => startOfDay(new Date(`${c}T00:00`)))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

const cadence = (cfg: PayoutSettings): number =>
  cfg.cadenceDays > 0 ? cfg.cadenceDays : DEFAULT_CADENCE_DAYS;

/** Дефолтная сетка без настроек: конец периода — ближайший вторник (включительно). */
function defaultCutoff(day: Date): Date {
  return isTuesday(day) ? day : nextTuesday(day);
}

/** Конец периода, в который попадает день `d` (ближайший cutoff ≥ d). */
export function cutoffOnOrAfter(d: Date, cfg: PayoutSettings): Date {
  const day = startOfDay(d);
  const list = anchors(cfg);
  if (list.length === 0) return defaultCutoff(day);

  const step = cadence(cfg);
  const first = list[0];
  if (day <= first) {
    // Раньше первой введённой даты — шагаем сеткой назад.
    let c = first;
    while (subDays(c, step).getTime() >= day.getTime()) c = subDays(c, step);
    return c;
  }
  const found = list.find((a) => a.getTime() >= day.getTime());
  if (found) return found;

  // Позже последней введённой даты — шагаем сеткой вперёд.
  let c = list[list.length - 1];
  while (c.getTime() < day.getTime()) c = addDays(c, step);
  return c;
}

/** Предыдущая граница периода (строго раньше `cutoff`). */
function previousCutoff(cutoff: Date, cfg: PayoutSettings): Date {
  const earlier = anchors(cfg).filter((a) => a.getTime() < cutoff.getTime());
  if (earlier.length > 0) return earlier[earlier.length - 1];
  return subDays(cutoff, cadence(cfg));
}

/** Расчётный период, в который попадает дата `d`. */
export function payPeriodOf(d: Date, cfg: PayoutSettings): PayPeriod {
  const cutoff = cutoffOnOrAfter(d, cfg);
  const prev = previousCutoff(cutoff, cfg);
  return {
    start: startOfDay(addDays(prev, 1)),
    end: endOfDay(cutoff),
    paidOn: startOfDay(addDays(cutoff, PAYOUT_DELAY_DAYS)),
  };
}

/** Соседний период (±N). Работает и на неровной сетке — шагаем через границы. */
export function shiftPayPeriod(
  period: PayPeriod,
  delta: number,
  cfg: PayoutSettings
): PayPeriod {
  let p = period;
  for (let i = 0; i < Math.abs(delta); i++) {
    p =
      delta > 0
        ? payPeriodOf(addDays(startOfDay(p.end), 1), cfg)
        : payPeriodOf(subDays(p.start, 1), cfg);
  }
  return p;
}

export function isInPayPeriod(iso: string, period: PayPeriod): boolean {
  const t = new Date(iso).getTime();
  return t >= period.start.getTime() && t <= period.end.getTime();
}

/** Конец текущего (ещё не закрытого) периода — дата, которую ждём от Wolt. */
export function currentCutoff(cfg: PayoutSettings, now: Date = new Date()): Date {
  return cutoffOnOrAfter(now, cfg);
}

/**
 * Закрылся ли период, а новая дата ещё не введена — тогда просим вписать её.
 * Пока настроек нет, тоже просим (первый ввод).
 */
export function needsNextCutoff(cfg: PayoutSettings, now: Date = new Date()): boolean {
  const list = anchors(cfg);
  if (list.length === 0) return true;
  const last = list[list.length - 1];
  return startOfDay(now).getTime() > last.getTime();
}

/** Подпись периода по его краям: «9–15 июл», «29 июн – 5 июл». */
export function payPeriodLabel(period: PayPeriod, locale: Locale = ru): string {
  const a = startOfDay(period.start);
  const b = startOfDay(period.end);
  if (a.getMonth() === b.getMonth()) {
    return `${format(a, 'd')}–${format(b, 'd MMM', { locale })}`;
  }
  return `${format(a, 'd MMM', { locale })} – ${format(b, 'd MMM', { locale })}`;
}

/** Добавить дату конца периода (идемпотентно, с сортировкой). */
export function addCutoff(cfg: PayoutSettings, date: string): PayoutSettings {
  const set = new Set(cfg.cutoffs);
  set.add(date);
  return { ...cfg, cutoffs: [...set].sort() };
}

export function removeCutoff(cfg: PayoutSettings, date: string): PayoutSettings {
  return { ...cfg, cutoffs: cfg.cutoffs.filter((c) => c !== date) };
}

/** Дата, которую логично предложить как следующую: последняя + шаг. */
export function suggestNextCutoff(cfg: PayoutSettings, now: Date = new Date()): string {
  const list = anchors(cfg);
  const base =
    list.length > 0 ? addDays(list[list.length - 1], cadence(cfg)) : currentCutoff(cfg, now);
  return format(base, 'yyyy-MM-dd');
}
