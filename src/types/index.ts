export type ISODate = string; // ISO 8601

export type Vehicle = 'bike' | 'scooter' | 'car';

export interface BreakInterval {
  start: ISODate;
  end: ISODate | null; // null = пауза идёт прямо сейчас
}

export interface Shift {
  id: string;
  status: 'active' | 'completed';
  startedAt: ISODate;
  endedAt: ISODate | null;
  breaks: BreakInterval[];
  earnings: number | null; // ₪ базовый заработок, вводится в конце смены
  tips: number | null; // ₪ чаевые, можно вписать позже (в Wolt видны не сразу)
  deliveries: number | null; // опционально
  vehicle: Vehicle | null;
  note: string | null;
}

export interface PlannedShift {
  id: string;
  date: ISODate; // дата планируемой смены
  plannedStart: string; // "18:00"
  plannedEnd: string; // "23:00"
  targetEarnings: number | null;
  auto?: boolean; // true = сгенерирован планировщиком цели; заменяется при пересчёте
}

/** Цели по заработку. Считаются по базе (без чаевых). */
export interface Goals {
  monthlyTarget: number | null; // ₪ за календарный месяц — единственная задаваемая цель
  weeklyTarget: number | null; // устар.: недельная цель больше не задаётся в UI (совместимость)
  offDays: string[]; // "yyyy-MM-dd" — выходные, исключаются из авто-плана под цель
}

/** Данные, которые вводятся при завершении смены. */
export interface EndShiftInput {
  earnings: number;
  tips?: number | null;
  deliveries?: number | null;
  vehicle?: Vehicle | null;
  note?: string | null;
}
