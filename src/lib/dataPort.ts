import type { Goals, PlannedShift, Shift } from '../types';
import { activeHours, breaksMs, ratePerHour, totalEarnings } from './time';
import { format } from 'date-fns';

const EXPORT_VERSION = 2;

export interface ExportBundle {
  app: 'wolt-tracker';
  version: number;
  exportedAt: string;
  shifts: Shift[];
  planned: PlannedShift[];
  goals?: Goals;
}

export function buildJson(shifts: Shift[], planned: PlannedShift[], goals: Goals): string {
  const bundle: ExportBundle = {
    app: 'wolt-tracker',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    shifts,
    planned,
    goals,
  };
  return JSON.stringify(bundle, null, 2);
}

function csvCell(v: string | number | null): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const VEHICLE_RU: Record<string, string> = { bike: 'вело', scooter: 'скутер', car: 'авто' };

export function buildCsv(shifts: Shift[]): string {
  const header = [
    'Дата',
    'Начало',
    'Конец',
    'Перерывы_мин',
    'Чистые_часы',
    'Заработок',
    'Чаевые',
    'Итого',
    'Ставка_шек_час',
    'Доставки',
    'Транспорт',
    'Заметка',
  ];
  const rows = shifts
    .filter((s) => s.status === 'completed' && s.endedAt)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .map((s) => {
      const start = new Date(s.startedAt);
      const end = new Date(s.endedAt as string);
      const brMin = Math.round(breaksMs(s.breaks, end.getTime()) / 60000);
      const rate = ratePerHour(s);
      return [
        format(start, 'yyyy-MM-dd'),
        format(start, 'HH:mm'),
        format(end, 'HH:mm'),
        brMin,
        activeHours(s).toFixed(2),
        s.earnings ?? '',
        s.tips ?? '',
        totalEarnings(s) ?? '',
        rate == null ? '' : rate.toFixed(1),
        s.deliveries ?? '',
        s.vehicle ? VEHICLE_RU[s.vehicle] : '',
        s.note ?? '',
      ]
        .map(csvCell)
        .join(',');
    });
  // BOM, чтобы Excel корректно понял UTF-8
  return '﻿' + [header.join(','), ...rows].join('\r\n');
}

export interface ParsedImport {
  shifts: Shift[];
  planned: PlannedShift[];
  goals: Goals;
}

/** Разбор и валидация импортируемого JSON. Бросает ошибку при неверном формате. */
export function parseImport(text: string): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Файл не является корректным JSON.');
  }
  const obj = data as Partial<ExportBundle>;
  if (!obj || !Array.isArray(obj.shifts)) {
    throw new Error('В файле нет списка смен (shifts).');
  }
  const shifts: Shift[] = obj.shifts.map((s) => ({
    id: s.id,
    status: s.status === 'active' ? 'active' : 'completed',
    startedAt: s.startedAt,
    endedAt: s.endedAt ?? null,
    breaks: Array.isArray(s.breaks) ? s.breaks : [],
    earnings: s.earnings ?? null,
    tips: s.tips ?? null,
    deliveries: s.deliveries ?? null,
    vehicle: s.vehicle ?? null,
    note: s.note ?? null,
  }));
  if (shifts.some((s) => !s.id || !s.startedAt)) {
    throw new Error('Некоторые смены повреждены (нет id или времени начала).');
  }
  const planned: PlannedShift[] = Array.isArray(obj.planned)
    ? obj.planned.map((p) => ({
        id: p.id,
        date: p.date,
        plannedStart: p.plannedStart,
        plannedEnd: p.plannedEnd,
        targetEarnings: p.targetEarnings ?? null,
        auto: p.auto ?? false,
      }))
    : [];
  const goals: Goals = {
    monthlyTarget: obj.goals?.monthlyTarget ?? null,
    weeklyTarget: obj.goals?.weeklyTarget ?? null,
  };
  return { shifts, planned, goals };
}

export function downloadFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function todayStamp(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
