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
import { cutoffOnOrAfter, hasPayoutSetup } from '../lib/payout';
import type { PayoutSettings } from '../types';
import { useI18n } from '../i18n/I18nProvider';

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

interface Props {
  monthDate: Date;
  plans: PlannedShift[]; // ручные планы
  shifts: Shift[]; // завершённые
  autoDays?: Map<string, { hours: number }>; // рекомендации под цель (derived)
  offDays?: Set<string>; // выходные (заданы пользователем)
  restDays?: Set<string>; // свободные дни под цель — можно отдыхать
  payouts: PayoutSettings; // ручные даты выплат — рисуем 💰 на концах периодов
  selected: string | null; // yyyy-MM-dd
  onSelectDay: (dateKey: string) => void;
}

export function MonthCalendar({
  monthDate,
  plans,
  shifts,
  autoDays,
  offDays,
  restDays,
  payouts,
  selected,
  onSelectDay,
}: Props) {
  const { t } = useI18n();
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [monthDate]);

  const plannedByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of plans) m.set(p.date, (m.get(p.date) ?? 0) + 1);
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

  // Концы расчётных периодов («payout after…») в видимом диапазоне.
  // Пока ни одной даты не введено — 💰 не рисуем, чтобы не показывать догадку.
  const payoutDays = useMemo(() => {
    const set = new Set<string>();
    if (!hasPayoutSetup(payouts)) return set;
    for (const d of days) set.add(dayKey(cutoffOnOrAfter(d, payouts)));
    return set;
  }, [days, payouts]);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {t.weekdays.map((d, i) => (
          <div key={i} className="text-center text-[11px] text-slate-500 font-medium py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = dayKey(d);
          const inMonth = isSameMonth(d, monthDate);
          const worked = workedByDay.get(k) ?? 0;
          const planned = plannedByDay.get(k) ?? 0;
          const auto = autoDays?.get(k);
          const off = offDays?.has(k) ?? false;
          const rest = (restDays?.has(k) ?? false) && !off && !auto && worked === 0 && planned === 0;
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
                      : auto && !off
                        ? 'bg-brand-500/5'
                        : 'bg-ink-900/40',
                inMonth ? '' : 'opacity-30',
              ].join(' ')}
            >
              <span
                className={[
                  'text-sm tabular',
                  off
                    ? 'line-through text-slate-500'
                    : today
                      ? 'font-bold text-brand-400'
                      : 'text-slate-200',
                ].join(' ')}
              >
                {format(d, 'd')}
              </span>
              {/* Маркеры */}
              <div className="flex items-center gap-0.5 mt-0.5 min-h-[10px]">
                {worked > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                {planned > 0 && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
                {auto && !off && (
                  <span className="text-[9px] leading-none text-brand-400 tabular">
                    {auto.hours}{t.units.hour}
                  </span>
                )}
                {off && <span className="text-[9px] leading-none">🚫</span>}
                {rest && <span className="text-[9px] leading-none">💤</span>}
              </div>
              {/* Конец расчётного периода. Не 💰: деньги приходят ПОСЛЕ этой даты,
                  а точный день прихода нам неизвестен — не выдаём догадку за факт. */}
              {isPayout && (
                <span
                  className="absolute top-0.5 right-1 text-[9px] leading-none"
                  title={t.calendar.payoutTitle}
                >
                  🏁
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t.calendar.worked}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> {t.calendar.plan}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-brand-400">N{t.units.hour}</span> {t.calendar.underGoal}
        </span>
        <span className="flex items-center gap-1">🚫 {t.calendar.off}</span>
        <span className="flex items-center gap-1">💤 {t.calendar.canRest}</span>
        <span className="flex items-center gap-1">🏁 {t.calendar.payout}</span>
      </div>
    </div>
  );
}

export { dayKey };
