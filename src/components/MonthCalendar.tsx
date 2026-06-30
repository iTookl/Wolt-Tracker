import { useMemo } from 'react';
import type { PlannedShift, Shift } from '../types';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { payWeekOf } from '../lib/payout';

// Неделя начинается с воскресенья (Израиль).
const WEEK_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

interface Props {
  monthDate: Date;
  plans: PlannedShift[];
  shifts: Shift[]; // завершённые
  selected: string | null; // yyyy-MM-dd
  onSelectDay: (dateKey: string) => void;
}

export function MonthCalendar({ monthDate, plans, shifts, selected, onSelectDay }: Props) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [monthDate]);

  const plannedByDay = useMemo(() => {
    const m = new Map<string, { manual: number; auto: number }>();
    for (const p of plans) {
      const e = m.get(p.date) ?? { manual: 0, auto: 0 };
      if (p.auto) e.auto += 1;
      else e.manual += 1;
      m.set(p.date, e);
    }
    return m;
  }, [plans]);

  const workedByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shifts) {
      const k = dayKey(new Date(s.startedAt));
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [shifts]);

  // Дни выплат (вторники) в видимом диапазоне.
  const payoutDays = useMemo(() => {
    const set = new Set<string>();
    for (const d of days) {
      const w = payWeekOf(d);
      set.add(dayKey(w.paidOn));
    }
    return set;
  }, [days]);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-center text-[11px] text-slate-500 font-medium py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = dayKey(d);
          const inMonth = isSameMonth(d, monthDate);
          const worked = workedByDay.get(k) ?? 0;
          const pm = plannedByDay.get(k) ?? { manual: 0, auto: 0 };
          const planned = pm.manual + pm.auto;
          const isSel = selected === k;
          const today = isToday(d);
          const isPayout = payoutDays.has(k);

          return (
            <button
              key={k}
              onClick={() => onSelectDay(k)}
              className={[
                'relative aspect-square rounded-xl flex flex-col items-center justify-center',
                'transition-colors',
                isSel
                  ? 'bg-brand-500/20 ring-2 ring-brand-500'
                  : worked > 0
                    ? 'bg-emerald-500/10'
                    : planned > 0
                      ? 'bg-ink-800'
                      : 'bg-ink-900/40',
                inMonth ? '' : 'opacity-30',
              ].join(' ')}
            >
              <span
                className={[
                  'text-sm tabular',
                  today ? 'font-bold text-brand-400' : 'text-slate-200',
                ].join(' ')}
              >
                {format(d, 'd')}
              </span>
              {/* Маркеры */}
              <div className="flex items-center gap-0.5 h-1.5 mt-0.5">
                {worked > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                {pm.manual > 0 && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
                {pm.auto > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full border border-brand-400" />
                )}
              </div>
              {isPayout && (
                <span className="absolute top-0.5 right-1 text-[9px] leading-none" title="Выплата Wolt">
                  💰
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> отработано
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> план
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full border border-brand-400" /> под цель
        </span>
        <span className="flex items-center gap-1">💰 выплата Wolt</span>
      </div>
    </div>
  );
}

export { dayKey };
