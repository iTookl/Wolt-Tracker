import { describe, it, expect } from 'vitest';
import type { Shift } from '../types';
import {
  MS_PER_HOUR,
  breaksMs,
  activeMs,
  activeHours,
  totalEarnings,
  ratePerHour,
  isPaused,
  currentBreakMs,
  formatDuration,
  formatHm,
  shiftToSegments,
  segmentsToTimes,
  segmentsActiveMs,
  plannedRange,
} from './time';

/** Смена с началом/концом в локальном времени; переопределяемые поля через patch. */
function makeShift(
  startedAt: Date,
  endedAt: Date | null,
  breaks: { start: Date; end: Date | null }[] = [],
  patch: Partial<Shift> = {}
): Shift {
  return {
    id: 's1',
    status: endedAt ? 'completed' : 'active',
    startedAt: startedAt.toISOString(),
    endedAt: endedAt ? endedAt.toISOString() : null,
    breaks: breaks.map((b) => ({
      start: b.start.toISOString(),
      end: b.end ? b.end.toISOString() : null,
    })),
    earnings: null,
    tips: null,
    deliveries: null,
    vehicle: null,
    note: null,
    ...patch,
  };
}

const D = (h: number, m = 0) => new Date(2026, 6, 4, h, m); // 4 июл 2026, локальное

describe('activeMs / activeHours', () => {
  it('чистое время = длительность минус паузы', () => {
    const s = makeShift(D(10), D(14), [{ start: D(11), end: D(11, 30) }]);
    expect(activeMs(s)).toBe(3.5 * MS_PER_HOUR);
    expect(activeHours(s)).toBeCloseTo(3.5, 6);
  });

  it('без пауз — вся длительность', () => {
    const s = makeShift(D(10), D(12));
    expect(activeHours(s)).toBeCloseTo(2, 6);
  });

  it('активная (открытая) смена считается от start до now', () => {
    const s = makeShift(D(10), null);
    const now = D(13).getTime();
    expect(activeHours(s, now)).toBeCloseTo(3, 6);
  });

  it('открытая пауза «тикает» до now', () => {
    const s = makeShift(D(10), null, [{ start: D(11), end: null }]);
    const now = D(12).getTime();
    // 2 ч всего − 1 ч открытой паузы = 1 ч
    expect(activeHours(s, now)).toBeCloseTo(1, 6);
  });

  it('никогда не уходит в минус', () => {
    const s = makeShift(D(10), D(10));
    expect(activeMs(s)).toBe(0);
  });
});

describe('breaksMs', () => {
  it('суммирует закрытые паузы, ограничивая по until', () => {
    const breaks = [
      { start: D(11).toISOString(), end: D(11, 30).toISOString() },
      { start: D(12).toISOString(), end: D(12, 15).toISOString() },
    ];
    expect(breaksMs(breaks, D(14).getTime())).toBe(45 * 60_000);
  });

  it('обрезает паузу, вылезающую за until', () => {
    const breaks = [{ start: D(11).toISOString(), end: D(13).toISOString() }];
    expect(breaksMs(breaks, D(12).getTime())).toBe(MS_PER_HOUR);
  });
});

describe('totalEarnings', () => {
  it('база + чаевые', () => {
    expect(totalEarnings(makeShift(D(10), D(12), [], { earnings: 100, tips: 20 }))).toBe(120);
  });
  it('только база (tips=null)', () => {
    expect(totalEarnings(makeShift(D(10), D(12), [], { earnings: 100 }))).toBe(100);
  });
  it('null, когда ничего не введено', () => {
    expect(totalEarnings(makeShift(D(10), D(12)))).toBeNull();
  });
});

describe('ratePerHour', () => {
  it('итог / чистые часы', () => {
    const s = makeShift(D(10), D(12), [], { earnings: 100, tips: 20 });
    expect(ratePerHour(s)).toBeCloseTo(60, 6); // 120 / 2ч
  });
  it('null при нулевой длительности', () => {
    const s = makeShift(D(10), D(10), [], { earnings: 100 });
    expect(ratePerHour(s)).toBeNull();
  });
  it('null без заработка', () => {
    expect(ratePerHour(makeShift(D(10), D(12)))).toBeNull();
  });
});

describe('isPaused / currentBreakMs', () => {
  it('открытая пауза → на паузе', () => {
    const s = makeShift(D(10), null, [{ start: D(11), end: null }]);
    expect(isPaused(s)).toBe(true);
    expect(currentBreakMs(s, D(11, 30).getTime())).toBe(30 * 60_000);
  });
  it('закрытая пауза → не на паузе, currentBreakMs=0', () => {
    const s = makeShift(D(10), null, [{ start: D(11), end: D(11, 30) }]);
    expect(isPaused(s)).toBe(false);
    expect(currentBreakMs(s, D(12).getTime())).toBe(0);
  });
});

describe('formatDuration / formatHm', () => {
  it('formatDuration ЧЧ:ММ:СС', () => {
    expect(formatDuration(3.5 * MS_PER_HOUR)).toBe('03:30:00');
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(-100)).toBe('00:00:00');
  });
  it('formatHm', () => {
    expect(formatHm(5 * MS_PER_HOUR + 23 * 60_000)).toBe('5ч 23м');
    expect(formatHm(23 * 60_000)).toBe('23м');
  });
});

describe('segments <-> times', () => {
  it('roundtrip сохраняет чистое время', () => {
    const s = makeShift(D(10), D(16), [
      { start: D(11), end: D(11, 30) },
      { start: D(13), end: D(14) },
    ]);
    const segs = shiftToSegments(s);
    expect(segs.length).toBe(3);
    expect(segmentsActiveMs(segs)).toBe(activeMs(s));

    const rebuilt = segmentsToTimes(segs);
    expect(rebuilt.startedAt).toBe(s.startedAt);
    expect(rebuilt.endedAt).toBe(s.endedAt);
    expect(rebuilt.breaks.length).toBe(2);
  });
});

describe('plannedRange', () => {
  it('обычный интервал в тот же день', () => {
    const { start, end } = plannedRange('2026-07-04', '18:00', '23:00');
    expect((end.getTime() - start.getTime()) / MS_PER_HOUR).toBeCloseTo(5, 6);
  });
  it('конец ≤ начала → смена уходит за полночь (+сутки)', () => {
    const { start, end } = plannedRange('2026-07-04', '22:00', '02:00');
    expect((end.getTime() - start.getTime()) / MS_PER_HOUR).toBeCloseTo(4, 6);
    expect(end.getDate()).toBe(5);
  });
});
