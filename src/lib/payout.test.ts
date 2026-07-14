import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import {
  addCutoff,
  defaultPayoutSettings,
  isInPayPeriod,
  needsNextCutoff,
  payPeriodLabel,
  payPeriodOf,
  removeCutoff,
  shiftPayPeriod,
  suggestNextCutoff,
} from './payout';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const cfgWith = (...dates: string[]) =>
  dates.reduce((c, d) => addCutoff(c, d), defaultPayoutSettings());

describe('дефолтная сетка (даты ещё не введены)', () => {
  const cfg = defaultPayoutSettings();

  it('период кончается ближайшим вторником, начинается средой', () => {
    const p = payPeriodOf(new Date(2026, 6, 4), cfg); // сб 4 июл
    expect(iso(p.start)).toBe('2026-07-01'); // ср
    expect(iso(p.end)).toBe('2026-07-07'); // вт, включительно
    expect(iso(p.paidOn)).toBe('2026-07-08');
  });

  it('сам вторник входит в свой период, среда открывает следующий', () => {
    expect(iso(payPeriodOf(new Date(2026, 6, 7), cfg).end)).toBe('2026-07-07');
    expect(iso(payPeriodOf(new Date(2026, 6, 8), cfg).end)).toBe('2026-07-14');
  });

  it('просит вписать первую дату', () => {
    expect(needsNextCutoff(cfg, new Date(2026, 6, 4))).toBe(true);
  });
});

describe('период по введённой дате («Next payout after 15 jul»)', () => {
  const cfg = cfgWith('2026-07-15');

  it('конец периода = вписанная дата, включительно', () => {
    const p = payPeriodOf(new Date(2026, 6, 14), cfg);
    expect(iso(p.end)).toBe('2026-07-15');
    expect(iso(p.start)).toBe('2026-07-09'); // день после предыдущей границы (8 июл)
    expect(iso(p.paidOn)).toBe('2026-07-16');
    expect(iso(payPeriodOf(new Date(2026, 6, 15), cfg).end)).toBe('2026-07-15');
  });

  it('за пределами введённых дат сетка достраивается шагом 7 дней', () => {
    expect(iso(payPeriodOf(new Date(2026, 6, 20), cfg).end)).toBe('2026-07-22');
    expect(iso(payPeriodOf(new Date(2026, 6, 2), cfg).end)).toBe('2026-07-08');
    expect(iso(payPeriodOf(new Date(2026, 5, 26), cfg).end)).toBe('2026-07-01');
  });

  it('период ещё идёт → новую дату не просим; после конца — просим', () => {
    expect(needsNextCutoff(cfg, new Date(2026, 6, 14))).toBe(false);
    expect(needsNextCutoff(cfg, new Date(2026, 6, 16))).toBe(true);
  });

  it('подсказка следующей даты = последняя + шаг', () => {
    expect(suggestNextCutoff(cfg, new Date(2026, 6, 16))).toBe('2026-07-22');
  });
});

describe('неровная сетка (даты идут не через 7 дней)', () => {
  // Wolt сдвинул выплату: вписаны 15 и 26 июл.
  const cfg = cfgWith('2026-07-15', '2026-07-26');

  it('введённые даты — авторитетные границы, период между ними длиннее недели', () => {
    const p = payPeriodOf(new Date(2026, 6, 20), cfg);
    expect(iso(p.start)).toBe('2026-07-16');
    expect(iso(p.end)).toBe('2026-07-26');
  });

  it('shiftPayPeriod ходит по границам в обе стороны', () => {
    const p = payPeriodOf(new Date(2026, 6, 20), cfg); // 16–26 июл
    expect(iso(shiftPayPeriod(p, -1, cfg).end)).toBe('2026-07-15');
    expect(iso(shiftPayPeriod(p, 1, cfg).end)).toBe('2026-08-02'); // дальше — шагом 7
    expect(iso(shiftPayPeriod(shiftPayPeriod(p, -1, cfg), 1, cfg).end)).toBe('2026-07-26');
  });
});

describe('isInPayPeriod / payPeriodLabel', () => {
  const cfg = cfgWith('2026-07-15');
  const p = payPeriodOf(new Date(2026, 6, 14), cfg); // 9–15 июл

  it('края периода включены', () => {
    expect(isInPayPeriod(new Date(2026, 6, 9, 0, 5).toISOString(), p)).toBe(true);
    expect(isInPayPeriod(new Date(2026, 6, 15, 23, 30).toISOString(), p)).toBe(true);
  });

  it('соседние дни не входят', () => {
    expect(isInPayPeriod(new Date(2026, 6, 8, 23).toISOString(), p)).toBe(false);
    expect(isInPayPeriod(new Date(2026, 6, 16).toISOString(), p)).toBe(false);
  });

  it('подпись по краям периода', () => {
    expect(payPeriodLabel(p)).toMatch(/^9–15\s/);
  });
});

describe('addCutoff / removeCutoff', () => {
  it('даты уникальны и отсортированы', () => {
    const cfg = cfgWith('2026-07-22', '2026-07-15', '2026-07-22');
    expect(cfg.cutoffs).toEqual(['2026-07-15', '2026-07-22']);
    expect(removeCutoff(cfg, '2026-07-15').cutoffs).toEqual(['2026-07-22']);
  });
});
