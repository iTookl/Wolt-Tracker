export type ISODate = string; // ISO 8601

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

/**
 * Расчётные периоды выплат Wolt — задаются вручную.
 * В приложении Wolt пишут «Next payout after 15 jul» — эту дату (конец периода)
 * пользователь и вписывает. Периоды = промежутки между соседними датами;
 * за пределами введённых дат достраиваются шагом `cadenceDays`.
 */
export interface PayoutSettings {
  cutoffs: string[]; // "yyyy-MM-dd" — концы расчётных периодов, введённые вручную
  cadenceDays: number; // шаг достройки периодов вперёд/назад (обычно 7)
}

/** Данные, которые вводятся при завершении смены. */
export interface EndShiftInput {
  earnings: number;
  tips?: number | null;
  deliveries?: number | null;
  note?: string | null;
}
