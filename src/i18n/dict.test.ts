import { describe, it, expect } from 'vitest';
import { ru, en } from './dict';

/** Рекурсивно строит «карту формы»: ключ → 'fn' | 'arr:N' | 'str' | вложенная карта. */
function shape(v: unknown): unknown {
  if (typeof v === 'function') return 'fn';
  if (Array.isArray(v)) return `arr:${v.length}`;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      out[k] = shape((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return 'str';
}

describe('словари i18n', () => {
  it('ru и en имеют одинаковую форму (ключи, функции, длины массивов)', () => {
    expect(shape(en)).toEqual(shape(ru));
  });

  it('дни недели — по 7 в каждом языке', () => {
    expect(ru.weekdays).toHaveLength(7);
    expect(en.weekdays).toHaveLength(7);
  });

  it('функции-склонения возвращают непустые строки', () => {
    for (const dict of [ru, en]) {
      expect(dict.stats.shiftsCount(1)).toBeTruthy();
      expect(dict.stats.shiftsCount(5)).toBeTruthy();
      expect(dict.data.importConfirm(2, 3)).toBeTruthy();
    }
  });
});
