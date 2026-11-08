import { describe, it, expect } from 'vitest';
import {
  daysBetween,
  israelToday,
  payoutStatus,
  saveNextPayout,
  validatePayoutDate,
} from './payoutDate';
import { defaultPayoutSettings } from './payout';
import { normalizePayouts } from './storage';

// Израиль летом UTC+3 (IDT), зимой UTC+2 (IST). Все моменты задаём в UTC,
// поэтому тесты не зависят от часового пояса машины.
const at = (isoUtc: string) => new Date(isoUtc);

describe('israelToday — календарная дата по Asia/Jerusalem', () => {
  it('летом: 20:59Z = 23:59 того же дня, 21:00Z = 00:00 следующего', () => {
    expect(israelToday(at('2026-07-15T20:59:59Z'))).toBe('2026-07-15');
    expect(israelToday(at('2026-07-15T21:00:00Z'))).toBe('2026-07-16');
  });

  it('зимой: 21:59Z = 23:59, 22:00Z = 00:00 следующего дня', () => {
    expect(israelToday(at('2026-01-10T21:59:59Z'))).toBe('2026-01-10');
    expect(israelToday(at('2026-01-10T22:00:00Z'))).toBe('2026-01-11');
  });
});

describe('daysBetween', () => {
  it('считает календарные дни без сдвигов из-за перехода на летнее время', () => {
    expect(daysBetween('2026-07-15', '2026-07-15')).toBe(0);
    expect(daysBetween('2026-07-15', '2026-07-18')).toBe(3);
    expect(daysBetween('2026-03-25', '2026-03-30')).toBe(5); // через переход на летнее время
    expect(daysBetween('2026-07-18', '2026-07-15')).toBe(-3);
  });
});

describe('payoutStatus', () => {
  const now = at('2026-07-15T09:00:00Z'); // 15 июл, 12:00 в Израиле

  it('даты нет → unset', () => {
    expect(payoutStatus([], now)).toEqual({ kind: 'unset' });
  });

  it('дата в будущем → upcoming с количеством дней', () => {
    expect(payoutStatus(['2026-07-18'], now)).toEqual({
      kind: 'upcoming',
      date: '2026-07-18',
      daysLeft: 3,
    });
  });

  it('дата сегодня → upcoming, 0 дней (ещё не прошла)', () => {
    expect(payoutStatus(['2026-07-15'], now)).toEqual({
      kind: 'upcoming',
      date: '2026-07-15',
      daysLeft: 0,
    });
  });

  it('дата вчера → passed', () => {
    expect(payoutStatus(['2026-07-14'], now)).toEqual({ kind: 'passed', date: '2026-07-14' });
  });

  it('граница полуночи по Израилю: 23:59 — ещё сегодня, 00:00 — уже прошла', () => {
    expect(payoutStatus(['2026-07-15'], at('2026-07-15T20:59:59Z')).kind).toBe('upcoming');
    expect(payoutStatus(['2026-07-15'], at('2026-07-15T21:00:00Z'))).toEqual({
      kind: 'passed',
      date: '2026-07-15',
    });
  });

  it('несколько дат: показывается ближайшая будущая, прошедшие — история', () => {
    expect(payoutStatus(['2026-07-08', '2026-07-22', '2026-07-29'], now)).toEqual({
      kind: 'upcoming',
      date: '2026-07-22',
      daysLeft: 7,
    });
    expect(payoutStatus(['2026-07-01', '2026-07-08'], now)).toEqual({
      kind: 'passed',
      date: '2026-07-08',
    });
  });

  it('мусорные значения игнорируются', () => {
    expect(payoutStatus(['', 'abc', '2026-02-30'], now)).toEqual({ kind: 'unset' });
  });
});

describe('validatePayoutDate', () => {
  const now = at('2026-07-15T09:00:00Z');

  it('пустое значение', () => {
    expect(validatePayoutDate('', now)).toBe('empty');
    expect(validatePayoutDate('   ', now)).toBe('empty');
  });

  it('некорректная дата', () => {
    expect(validatePayoutDate('15.07.2026', now)).toBe('invalid');
    expect(validatePayoutDate('2026-13-01', now)).toBe('invalid');
  });

  it('прошлое нельзя, сегодня и будущее можно', () => {
    expect(validatePayoutDate('2026-07-14', now)).toBe('past');
    expect(validatePayoutDate('2026-07-15', now)).toBeNull();
    expect(validatePayoutDate('2026-07-22', now)).toBeNull();
  });

  it('«прошлое» тоже определяется по Израилю: в 00:30 по Израилю вчерашняя дата — уже прошлое', () => {
    expect(validatePayoutDate('2026-07-15', at('2026-07-15T21:30:00Z'))).toBe('past');
  });
});

describe('saveNextPayout', () => {
  const now = at('2026-07-15T09:00:00Z');

  it('после прошедшей даты новая добавляется, старая остаётся в истории периодов', () => {
    const cfg = { ...defaultPayoutSettings(), cutoffs: ['2026-07-08'] };
    expect(saveNextPayout(cfg, '2026-07-22', now).cutoffs).toEqual(['2026-07-08', '2026-07-22']);
  });

  it('правка будущей даты заменяет её, а не плодит вторую', () => {
    const cfg = { ...defaultPayoutSettings(), cutoffs: ['2026-07-08', '2026-07-22'] };
    expect(saveNextPayout(cfg, '2026-07-23', now).cutoffs).toEqual(['2026-07-08', '2026-07-23']);
  });

  it('прошлую дату не сохраняет (возвращает настройки без изменений)', () => {
    const cfg = { ...defaultPayoutSettings(), cutoffs: ['2026-07-08'] };
    expect(saveNextPayout(cfg, '2026-07-10', now)).toBe(cfg);
  });
});

describe('совместимость с уже сохранёнными данными', () => {
  it('старые payouts из storage читаются как есть — миграция формата не нужна', () => {
    const stored = normalizePayouts({ cutoffs: ['2026-07-15', '2026-07-08'], cadenceDays: 7 });
    expect(stored.cutoffs).toEqual(['2026-07-08', '2026-07-15']);
    expect(payoutStatus(stored.cutoffs, at('2026-07-10T09:00:00Z'))).toEqual({
      kind: 'upcoming',
      date: '2026-07-15',
      daysLeft: 5,
    });
  });

  it('данные до v3 (без payouts) → дата не задана, без выдуманной даты', () => {
    expect(payoutStatus(normalizePayouts(undefined).cutoffs, at('2026-07-10T09:00:00Z'))).toEqual(
      { kind: 'unset' }
    );
  });
});
