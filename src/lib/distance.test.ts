import { describe, it, expect } from 'vitest';
import type { Shift } from '../types';
import {
  aggregateKm,
  kmDraftFrom,
  kmFromDraft,
  odometerDistance,
  parseKm,
  shiftKm,
} from './distance';
import { ratePerHour } from './time';
import { migrate } from './storage';
import { buildCsv, buildJson, parseImport } from './dataPort';
import { ru } from '../i18n/dict';

const shift = (over: Partial<Shift> = {}): Shift => ({
  id: 'x',
  status: 'completed',
  startedAt: '2026-07-15T10:00:00.000Z',
  endedAt: '2026-07-15T15:40:00.000Z', // 5:40
  breaks: [],
  earnings: 450,
  tips: null,
  deliveries: null,
  note: null,
  ...over,
});

describe('parseKm', () => {
  it('число с точкой или запятой, пустое → null', () => {
    expect(parseKm('44.7')).toBe(44.7);
    expect(parseKm('44,7')).toBe(44.7);
    expect(parseKm(' 12 ')).toBe(12);
    expect(parseKm('')).toBeNull();
    expect(parseKm('abc')).toBeNull();
    expect(parseKm('-3')).toBeNull();
  });
});

describe('odometerDistance', () => {
  it('разница конец − начало', () => {
    expect(odometerDistance(12_340, 12_392.5)).toBeCloseTo(52.5);
  });
  it('нет значения или конец меньше начала → null', () => {
    expect(odometerDistance(null, 100)).toBeNull();
    expect(odometerDistance(100, null)).toBeNull();
    expect(odometerDistance(200, 100)).toBeNull();
  });
});

describe('shiftKm — метрики одной смены', () => {
  it('пример из ТЗ: 5:40 ч, 44.7 км Wolt, 450 ₪ → 79.41 ₪/ч и 10.07 ₪/км', () => {
    const s = shift({ woltKm: 44.7 });
    expect(ratePerHour(s)!).toBeCloseTo(79.41, 2);
    const m = shiftKm(s);
    expect(m.perWoltKm!).toBeCloseTo(10.07, 2);
    expect(m.perActualKm).toBeNull();
    expect(m.emptyKm).toBeNull();
    expect(m.emptyPct).toBeNull();
  });

  it('с реальным пробегом: ₪/км по реальному и пустой пробег в км и %', () => {
    const m = shiftKm(shift({ woltKm: 44.7, actualKm: 60 }));
    expect(m.perActualKm!).toBeCloseTo(7.5, 5);
    expect(m.emptyKm!).toBeCloseTo(15.3, 5);
    expect(m.emptyPct!).toBeCloseTo(25.5, 5);
  });

  it('ставка за км считается по базе + чаевые (как ₪/ч)', () => {
    expect(shiftKm(shift({ tips: 50, actualKm: 50 })).perActualKm).toBe(10);
  });

  it('0 км или нет заработка — без деления на ноль', () => {
    const m = shiftKm(shift({ woltKm: 0, actualKm: 0 }));
    expect(m.perWoltKm).toBeNull();
    expect(m.perActualKm).toBeNull();
    expect(m.emptyPct).toBeNull();
    expect(shiftKm(shift({ earnings: null, woltKm: 10 })).perWoltKm).toBeNull();
  });

  it('старая смена без полей км → все метрики null', () => {
    const m = shiftKm(shift());
    expect(m).toEqual({
      woltKm: null,
      actualKm: null,
      perWoltKm: null,
      perActualKm: null,
      emptyKm: null,
      emptyPct: null,
    });
  });
});

describe('aggregateKm — сводка: сумма ₪ / сумма км, а не среднее средних', () => {
  it('взвешивает по километрам', () => {
    // 100 ₪ / 10 км = 10 ₪/км и 300 ₪ / 50 км = 6 ₪/км.
    // Среднее средних было бы 8, правильно: 400 / 60 = 6.67.
    const a = aggregateKm([
      shift({ earnings: 100, actualKm: 10, woltKm: 8 }),
      shift({ earnings: 300, actualKm: 50, woltKm: 40 }),
    ]);
    expect(a.perActualKm!).toBeCloseTo(400 / 60, 5);
    expect(a.perWoltKm!).toBeCloseTo(400 / 48, 5);
    expect(a.emptyKm!).toBeCloseTo(12, 5);
    expect(a.emptyPct!).toBeCloseTo(20, 5);
    expect(a.actualShifts).toBe(2);
  });

  it('смены без км не участвуют и не ломают статистику', () => {
    const a = aggregateKm([
      shift({ earnings: 999 }), // старая смена — без км
      shift({ earnings: 100, woltKm: 10 }),
      shift({ earnings: 200, actualKm: 25 }),
    ]);
    expect(a.perWoltKm).toBe(10); // только смена с woltKm
    expect(a.perActualKm).toBe(8); // только смена с actualKm
    expect(a.emptyKm).toBeNull(); // нет ни одной смены с обоими значениями
    expect(a.woltShifts).toBe(1);
    expect(a.actualShifts).toBe(1);
  });

  it('пусто → всё null', () => {
    const a = aggregateKm([shift(), shift()]);
    expect(a.perWoltKm).toBeNull();
    expect(a.perActualKm).toBeNull();
    expect(a.totalActualKm).toBe(0);
  });
});

describe('обратная совместимость данных', () => {
  const oldRecord = {
    id: 'old-1',
    status: 'completed',
    startedAt: '2026-07-01T10:00:00.000Z',
    endedAt: '2026-07-01T15:00:00.000Z',
    breaks: [],
    earnings: 400,
    tips: 20,
    deliveries: 12,
    note: 'до фичи км',
  };

  it('старая запись из localStorage (без км) читается и считается как раньше', () => {
    const db = migrate({ version: 3, shifts: [oldRecord] } as never);
    const s = db.shifts[0];
    expect(s.woltKm).toBeNull();
    expect(s.actualKm).toBeNull();
    expect(s.earnings).toBe(400);
    expect(ratePerHour(s)).toBe(84); // (400 + 20) / 5 ч
    expect(shiftKm(s).perActualKm).toBeNull();
  });

  it('новые поля км переживают перезагрузку (migrate их не выбрасывает)', () => {
    const db = migrate({
      version: 3,
      shifts: [{ ...oldRecord, woltKm: 44.7, actualKm: 60 }],
    } as never);
    expect(db.shifts[0].woltKm).toBe(44.7);
    expect(db.shifts[0].actualKm).toBe(60);
  });

  it('мусор в полях км → null, а не NaN', () => {
    const db = migrate({
      version: 3,
      shifts: [{ ...oldRecord, woltKm: 'abc', actualKm: -5 }],
    } as never);
    expect(db.shifts[0].woltKm).toBeNull();
    expect(db.shifts[0].actualKm).toBeNull();
  });

  it('экспорт → импорт JSON сохраняет км; старый бэкап без км импортируется', () => {
    const s = shift({ woltKm: 44.7, actualKm: 60 });
    const json = buildJson([s], [], { monthlyTarget: null, weeklyTarget: null, offDays: [] }, {
      cutoffs: [],
      cadenceDays: 7,
    });
    const back = parseImport(json, ru).shifts[0];
    expect(back.woltKm).toBe(44.7);
    expect(back.actualKm).toBe(60);

    const legacy = parseImport(JSON.stringify({ shifts: [oldRecord] }), ru).shifts[0];
    expect(legacy.woltKm).toBeNull();
    expect(legacy.actualKm).toBeNull();
  });

  it('CSV: старые колонки на месте, км добавлены в конец', () => {
    const csv = buildCsv([shift({ woltKm: 44.7, actualKm: 60 }), shift()], ru);
    const [header, withKm, withoutKm] = csv.replace('﻿', '').split('\r\n');
    expect(header.split(',').slice(0, 11)).toEqual([
      'Дата', 'Начало', 'Конец', 'Перерывы_мин', 'Чистые_часы', 'Заработок',
      'Чаевые', 'Итого', 'Ставка_шек_час', 'Доставки', 'Заметка',
    ]);
    expect(withKm.split(',').slice(11)).toEqual(['44.7', '60', '10.07', '7.50']);
    expect(withoutKm.split(',').slice(11)).toEqual(['', '', '', '']);
  });
});

describe('kmFromDraft — ввод в форме', () => {
  const base = { wolt: '', mode: 'number' as const, actual: '', odoStart: '', odoEnd: '' };

  it('одно число', () => {
    expect(kmFromDraft({ ...base, wolt: '44,7', actual: '60' })).toEqual({
      woltKm: 44.7,
      actualKm: 60,
      odometerError: false,
    });
  });

  it('одометр: разница считается автоматически', () => {
    expect(kmFromDraft({ ...base, mode: 'odometer', odoStart: '12340', odoEnd: '12392.5' })).toEqual(
      { woltKm: null, actualKm: 52.5, odometerError: false }
    );
  });

  it('одометр: конец меньше начала → ошибка, пробег не сохраняется', () => {
    expect(kmFromDraft({ ...base, mode: 'odometer', odoStart: '500', odoEnd: '400' })).toEqual({
      woltKm: null,
      actualKm: null,
      odometerError: true,
    });
  });

  it('пустые поля → null (поля необязательные)', () => {
    expect(kmFromDraft(base)).toEqual({ woltKm: null, actualKm: null, odometerError: false });
  });

  it('kmDraftFrom: старая смена без км → пустые поля', () => {
    expect(kmDraftFrom({})).toEqual(base);
    expect(kmDraftFrom({ woltKm: 44.7, actualKm: 60 })).toMatchObject({ wolt: '44.7', actual: '60' });
  });
});
