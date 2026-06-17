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
  earnings: number | null; // ₪, вводится в конце смены
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
}

/** Данные, которые вводятся при завершении смены. */
export interface EndShiftInput {
  earnings: number;
  deliveries?: number | null;
  vehicle?: Vehicle | null;
  note?: string | null;
}
