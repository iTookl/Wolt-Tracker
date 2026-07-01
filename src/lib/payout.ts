import {
  addDays,
  endOfDay,
  format,
  isTuesday,
  nextTuesday,
  startOfDay,
  subDays,
} from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Расчётный период выплаты Wolt.
 *
 * Деньги приходят каждую СРЕДУ. Неделя заканчивается ВТОРНИКОМ, и заработок за
 * вторник падает в выплату уже на следующий день — в среду. Значит период =
 * СРЕДА…ВТОРНИК включительно (7 дней), выплата = среда сразу после вторника.
 *
 * Пример:
 *   смены 1–7 июля (ср 1 … вт 7) ⇒ 💰 Ср 8.7
 *   смены 8–14 июля (ср 8 … вт 14) ⇒ 💰 Ср 15.7
 */

export interface PayWeek {
  start: Date; // среда 00:00 (включительно) — для фильтрации смен
  end: Date; // вторник 23:59:59 (включительно)
  paidOn: Date; // среда — день прихода денег (на следующий день после вторника)
}

/** Вторник, которым закрывается период, содержащий дату `d` (включительно). */
function closingTuesday(d: Date): Date {
  const day = startOfDay(d);
  return isTuesday(day) ? day : nextTuesday(day);
}

/** Расчётный период, в который попадает дата `d`. */
export function payWeekOf(d: Date): PayWeek {
  const endTue = closingTuesday(d);
  const start = startOfDay(subDays(endTue, 6)); // среда = вторник − 6 дней
  const end = endOfDay(endTue); // вторник включительно
  const paidOn = startOfDay(addDays(endTue, 1)); // среда — на следующий день
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
 * Заголовок расчётной недели по её краям: среда → вторник, «1–7 июл.».
 * Деньги за неделю приходят на следующий день после конца — см. `week.paidOn`.
 */
export function payWeekLabel(week: PayWeek): string {
  const a = startOfDay(week.start); // среда
  const b = startOfDay(week.end); // вторник
  const sameMonth = a.getMonth() === b.getMonth();
  if (sameMonth) {
    return `${format(a, 'd')}–${format(b, 'd MMM', { locale: ru })}`;
  }
  return `${format(a, 'd MMM', { locale: ru })} – ${format(b, 'd MMM', { locale: ru })}`;
}
