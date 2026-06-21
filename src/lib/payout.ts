import {
  addDays,
  endOfDay,
  format,
  nextTuesday,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Расчётная неделя Wolt: понедельник–воскресенье (7 дней).
 * Деньги приходят во вторник после закрытия недели; сумму видно с понедельника.
 * Пример: Пн 15.6 → Вс 21.6 ⇒ видно Пн 22.6 ⇒ 💰 Вт 23.6.
 */

export interface PayWeek {
  start: Date; // понедельник 00:00
  end: Date; // воскресенье 23:59:59
  paidOn: Date; // вторник после закрытия недели
}

/** Расчётная неделя, в которую попадает дата `d`. */
export function payWeekOf(d: Date): PayWeek {
  const start = startOfWeek(d, { weekStartsOn: 1 }); // Пн
  const end = endOfDay(addDays(start, 6)); // Вс
  const paidOn = startOfDay(nextTuesday(end)); // ближайший Вт после Вс
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
 * Заголовок недели по границам понедельник→понедельник, как считает Wolt:
 * "15–22 июн." (конец = следующий понедельник, день, когда видно сумму).
 * Сами смены при этом считаются за Пн–Вс — Пн 22 уже относится к неделе «22–29».
 */
export function payWeekLabel(week: PayWeek): string {
  const labelEnd = addDays(week.start, 7); // следующий понедельник
  const sameMonth = week.start.getMonth() === labelEnd.getMonth();
  if (sameMonth) {
    return `${format(week.start, 'd')}–${format(labelEnd, 'd MMM', { locale: ru })}`;
  }
  return `${format(week.start, 'd MMM', { locale: ru })} – ${format(labelEnd, 'd MMM', { locale: ru })}`;
}
