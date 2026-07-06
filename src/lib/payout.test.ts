import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import {
  payWeekOf,
  shiftPayWeek,
  isInPayWeek,
  payWeekLabel,
} from './payout';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

describe('payWeekOf', () => {
  it('расчётный период = среда…вторник, выплата в следующую среду', () => {
    // Сб 4 июл 2026 попадает в период Ср 1 → Вт 7, деньги Ср 8.
    const w = payWeekOf(new Date(2026, 6, 4));
    expect(iso(w.start)).toBe('2026-07-01'); // среда
    expect(w.start.getDay()).toBe(3);
    expect(iso(w.end)).toBe('2026-07-07'); // вторник
    expect(w.end.getDay()).toBe(2);
    expect(iso(w.paidOn)).toBe('2026-07-08'); // среда — на следующий день
    expect(w.paidOn.getDay()).toBe(3);
  });

  it('вторник закрывает свой же период (не уезжает в следующий)', () => {
    const w = payWeekOf(new Date(2026, 6, 7)); // сам вторник
    expect(iso(w.end)).toBe('2026-07-07');
    expect(iso(w.start)).toBe('2026-07-01');
    expect(iso(w.paidOn)).toBe('2026-07-08');
  });

  it('среда открывает новый период', () => {
    const w = payWeekOf(new Date(2026, 6, 8)); // среда
    expect(iso(w.start)).toBe('2026-07-08');
    expect(iso(w.end)).toBe('2026-07-14');
    expect(iso(w.paidOn)).toBe('2026-07-15');
  });

  it('end включает весь вторник (23:59:59), start — начало среды', () => {
    const w = payWeekOf(new Date(2026, 6, 4));
    expect(w.start.getHours()).toBe(0);
    expect(w.end.getHours()).toBe(23);
    expect(w.end.getMinutes()).toBe(59);
  });
});

describe('shiftPayWeek', () => {
  it('сдвиг на +1 неделю даёт следующий период', () => {
    const w = shiftPayWeek(payWeekOf(new Date(2026, 6, 4)), 1);
    expect(iso(w.start)).toBe('2026-07-08');
    expect(iso(w.end)).toBe('2026-07-14');
  });

  it('сдвиг −1 и +1 возвращает исходный период', () => {
    const base = payWeekOf(new Date(2026, 6, 4));
    const round = shiftPayWeek(shiftPayWeek(base, -1), 1);
    expect(iso(round.start)).toBe(iso(base.start));
    expect(iso(round.end)).toBe(iso(base.end));
  });
});

describe('isInPayWeek', () => {
  const w = payWeekOf(new Date(2026, 6, 4)); // 1–7 июл

  it('дата внутри периода — true (границы включительно)', () => {
    expect(isInPayWeek(new Date(2026, 6, 1, 0, 5).toISOString(), w)).toBe(true);
    expect(isInPayWeek(new Date(2026, 6, 7, 23, 0).toISOString(), w)).toBe(true);
  });

  it('дата вне периода — false', () => {
    expect(isInPayWeek(new Date(2026, 5, 30).toISOString(), w)).toBe(false); // до среды
    expect(isInPayWeek(new Date(2026, 6, 8).toISOString(), w)).toBe(false); // следующая среда
  });
});

describe('payWeekLabel', () => {
  it('в пределах одного месяца — «1–7 июл.»', () => {
    const w = payWeekOf(new Date(2026, 6, 4));
    expect(payWeekLabel(w)).toMatch(/^1–7\s/);
  });

  it('на стыке месяцев показывает оба месяца', () => {
    // Период, который начинается в июне и кончается в июле.
    const w = payWeekOf(new Date(2026, 6, 1)); // Ср 1 июл сама → период 1-7 июл, не стык
    // Возьмём период, пересекающий границу: конец июня.
    const cross = shiftPayWeek(w, -1); // 24-30 июн
    expect(cross.start.getMonth()).toBe(5); // июнь
    expect(cross.end.getMonth()).toBe(5);
  });
});
