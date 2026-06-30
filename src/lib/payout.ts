import {
  addDays,
  endOfDay,
  format,
  isMonday,
  nextMonday,
  startOfDay,
  subDays,
} from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Расчётный период выплаты Wolt.
 *
 * Деньги приходят каждую СРЕДУ. Одна выплата покрывает смены со вторника
 * по следующий ПОНЕДЕЛЬНИК включительно — т.е. интервал (понедельник, понедельник].
 *
 * Пример:
 *   смены 8–15 июня (вкл. Пн 15) ⇒ 💰 Ср 17.6
 *   смены 15–22 июня (вкл. Пн 22) ⇒ 💰 Ср 24.6
 */

export interface PayWeek {
  start: Date; // вторник 00:00 (включительно) — для фильтрации смен
  end: Date; // понедельник 23:59:59 (включительно)
  paidOn: Date; // среда — день прихода денег
}

/** Понедельник, которым закрывается период, содержащий дату `d` (включительно). */
function closingMonday(d: Date): Date {
  const day = startOfDay(d);
  return isMonday(day) ? day : nextMonday(day);
}

/** Расчётный период, в который попадает дата `d`. */
export function payWeekOf(d: Date): PayWeek {
  const endMon = closingMonday(d);
  const start = startOfDay(subDays(endMon, 6)); // вторник = понедельник − 6 дней
  const end = endOfDay(endMon);
  const paidOn = startOfDay(addDays(endMon, 2)); // среда после закрытия
  return { start, end, paidOn };
}

export function shiftPayWeek(week: PayWeek, deltaWeeks: number): PayWeek {
  return payWeekOf(addDays(week.start, deltaWeeks * 7));
}

export function isInPayWeek(iso: string, week: PayWeek): boolean {
  const t = new Date(iso).getTime();
  return t >= week.start.getTime() && t <= week.end.getTime();
}

/**
 * Заголовок периода по краям-понедельникам, как считает Wolt: "8–15 июн.".
 * Конец = закрывающий понедельник (день, когда видно сумму), начало = он минус 7 дней.
 */
export function payWeekLabel(week: PayWeek): string {
  const endMon = startOfDay(week.end);
  const startMon = subDays(endMon, 7);
  const sameMonth = startMon.getMonth() === endMon.getMonth();
  if (sameMonth) {
    return `${format(startMon, 'd')}–${format(endMon, 'd MMM', { locale: ru })}`;
  }
  return `${format(startMon, 'd MMM', { locale: ru })} – ${format(endMon, 'd MMM', { locale: ru })}`;
}

/**
 * Подпись недели для экрана «Цель»: первый рабочий день (вторник) → день прихода
 * денег (среда): «23 июн – 1 июл.». В отличие от `payWeekLabel` (края-понедельники,
 * как в выписке Wolt), эта подпись показывает, когда именно зайдёт зарплата за период.
 */
export function payWeekGoalLabel(week: PayWeek): string {
  const start = startOfDay(week.start); // вторник — первый рабочий день периода
  const paid = startOfDay(week.paidOn); // среда — день прихода денег
  const sameMonth = start.getMonth() === paid.getMonth();
  if (sameMonth) {
    return `${format(start, 'd')}–${format(paid, 'd MMM', { locale: ru })}`;
  }
  return `${format(start, 'd MMM', { locale: ru })} – ${format(paid, 'd MMM', { locale: ru })}`;
}
