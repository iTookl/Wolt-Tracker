import type { Goals, PlannedShift, Shift } from '../types';

/**
 * Изолированный слой хранения (репозиторий).
 * UI и хуки общаются ТОЛЬКО через `storage` и не знают, что под капотом localStorage.
 * Это позволит позже заменить реализацию на IndexedDB без переписывания UI.
 */

const KEY = 'wolt-tracker:db';
const SCHEMA_VERSION = 2;

interface PersistShape {
  version: number;
  shifts: Shift[];
  planned: PlannedShift[];
  goals: Goals;
}

export interface DbSnapshot {
  shifts: Shift[];
  planned: PlannedShift[];
  goals: Goals;
}

const emptyGoals = (): Goals => ({ monthlyTarget: null, weeklyTarget: null, offDays: [] });

function empty(): PersistShape {
  return { version: SCHEMA_VERSION, shifts: [], planned: [], goals: emptyGoals() };
}

/** Нормализует цели из произвольных данных (v1 их не имел). */
function normalizeGoals(g: Partial<Goals> | null | undefined): Goals {
  return {
    monthlyTarget: g?.monthlyTarget ?? null,
    weeklyTarget: g?.weeklyTarget ?? null,
    offDays: Array.isArray(g?.offDays) ? g!.offDays : [],
  };
}

/** Точка для будущих миграций схемы (по data.version). */
function migrate(data: Partial<PersistShape> | null): PersistShape {
  if (!data) return empty();
  // Нормализуем форму: добавляем поля, появившиеся позже (tips), и отбрасываем
  // удалённые (vehicle) — поля перечислены явно, старые лишние ключи не протекают.
  const shifts = (Array.isArray(data.shifts) ? data.shifts : []).map((s) => ({
    id: s.id,
    status: s.status,
    startedAt: s.startedAt,
    endedAt: s.endedAt ?? null,
    breaks: Array.isArray(s.breaks) ? s.breaks : [],
    earnings: s.earnings ?? null,
    tips: s.tips ?? null,
    deliveries: s.deliveries ?? null,
    note: s.note ?? null,
  }));
  return {
    version: SCHEMA_VERSION,
    shifts,
    // Устаревшие авто-планы (auto:true) чистим: в новой модели график под цель
    // считается на лету и не персистится. Ручные планы остаются.
    planned: (Array.isArray(data.planned) ? data.planned : []).filter((p) => !p?.auto),
    goals: normalizeGoals(data.goals), // v1 → v2: цели появились здесь
  };
}

function read(): PersistShape {
  if (typeof localStorage === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return migrate(JSON.parse(raw) as Partial<PersistShape>);
  } catch (e) {
    console.error('storage: не удалось прочитать данные', e);
    return empty();
  }
}

function write(data: PersistShape): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, version: SCHEMA_VERSION }));
  } catch (e) {
    console.error('storage: не удалось сохранить данные', e);
  }
}

export const storage = {
  load(): DbSnapshot {
    const d = read();
    return { shifts: d.shifts, planned: d.planned, goals: d.goals };
  },

  save(snapshot: DbSnapshot): void {
    write({ version: SCHEMA_VERSION, ...snapshot });
  },

  /** Экспорт сырого JSON (для будущего экспорта/импорта). */
  exportRaw(): string {
    return JSON.stringify(read(), null, 2);
  },
};
