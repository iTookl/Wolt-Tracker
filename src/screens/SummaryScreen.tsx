import { useMemo, useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { activeHours, totalEarnings } from '../lib/time';
import { formatMoney, formatRate } from '../lib/money';
import { StatCard } from '../components/ui/Card';
import { startOfMonth, startOfWeek } from 'date-fns';

type Period = 'week' | 'month' | 'all';

const periods: { id: Period; label: string }[] = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Всё время' },
];

export function SummaryScreen() {
  const { completed } = useShifts();
  const [period, setPeriod] = useState<Period>('week');

  const stats = useMemo(() => {
    const now = new Date();
    // Неделя по-израильски начинается с воскресенья.
    const from =
      period === 'week'
        ? startOfWeek(now, { weekStartsOn: 0 })
        : period === 'month'
          ? startOfMonth(now)
          : null;

    const inRange = completed.filter(
      (s) => from == null || new Date(s.startedAt) >= from
    );

    const totalHours = inRange.reduce((sum, s) => sum + activeHours(s), 0);
    const earningsSum = inRange.reduce((sum, s) => sum + (totalEarnings(s) ?? 0), 0);
    const avgRate = totalHours > 0 ? earningsSum / totalHours : null;

    return { count: inRange.length, totalHours, totalEarnings: earningsSum, avgRate };
  }, [completed, period]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Сводка</h1>

      <div className="grid grid-cols-3 gap-2">
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={[
              'min-h-[44px] rounded-xl text-sm font-medium transition-colors',
              p.id === period
                ? 'bg-brand-500 text-white'
                : 'bg-ink-800 text-slate-300 hover:bg-ink-700',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}
      </div>

      <StatCard
        label="Средний заработок в час"
        value={formatRate(stats.avgRate)}
        hint={`на основе ${stats.count} ${pluralShifts(stats.count)}`}
        accent
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Всего часов"
          value={stats.totalHours.toLocaleString('he-IL', { maximumFractionDigits: 1 })}
        />
        <StatCard label="Всего заработано" value={formatMoney(stats.totalEarnings)} />
      </div>

      {stats.count === 0 && (
        <p className="text-center text-slate-500 text-sm pt-4">
          За этот период смен нет.
        </p>
      )}
    </div>
  );
}

function pluralShifts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'смены';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'смен';
  return 'смен';
}
