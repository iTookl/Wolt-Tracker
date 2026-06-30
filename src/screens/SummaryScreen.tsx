import { useMemo, useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { activeHours, totalEarnings } from '../lib/time';
import { formatMoney, formatRate } from '../lib/money';
import { StatCard, Card } from '../components/ui/Card';
import { DataSection } from '../components/DataSection';
import { isInPayWeek, payWeekLabel, payWeekOf, shiftPayWeek } from '../lib/payout';
import {
  format,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Shift } from '../types';

type Period = 'week' | 'month' | 'all';

const periods: { id: Period; label: string }[] = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Всё время' },
];

function agg(shifts: Shift[]) {
  const totalHours = shifts.reduce((sum, s) => sum + activeHours(s), 0);
  const earningsSum = shifts.reduce((sum, s) => sum + (totalEarnings(s) ?? 0), 0);
  return {
    count: shifts.length,
    totalHours,
    totalEarnings: earningsSum,
    avgRate: totalHours > 0 ? earningsSum / totalHours : null,
  };
}

export function SummaryScreen() {
  const { completed } = useShifts();
  const [period, setPeriod] = useState<Period>('week');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = текущая расчётная неделя
  const [monthOffset, setMonthOffset] = useState(0);

  const week = useMemo(() => shiftPayWeek(payWeekOf(new Date()), weekOffset), [weekOffset]);

  const weekShifts = useMemo(
    () => completed.filter((s) => isInPayWeek(s.startedAt, week)),
    [completed, week]
  );

  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthShifts = useMemo(
    () => completed.filter((s) => isSameMonth(new Date(s.startedAt), monthDate)),
    [completed, monthDate]
  );

  const data =
    period === 'week' ? weekShifts : period === 'month' ? monthShifts : completed;
  const stats = agg(data);

  // Выплаты, попадающие в выбранный месяц (по дате прихода денег).
  const monthPayouts = useMemo(() => {
    if (period !== 'month') return [];
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const list: { paidOn: Date; label: string; amount: number }[] = [];
    // Перебираем расчётные недели вокруг месяца.
    for (let i = -1; i <= 5; i++) {
      const w = shiftPayWeek(payWeekOf(mStart), i);
      if (isWithinInterval(w.paidOn, { start: mStart, end: mEnd })) {
        const amount = completed
          .filter((s) => isInPayWeek(s.startedAt, w))
          .reduce((sum, s) => sum + (totalEarnings(s) ?? 0), 0);
        list.push({ paidOn: w.paidOn, label: payWeekLabel(w), amount });
      }
    }
    return list.sort((a, b) => a.paidOn.getTime() - b.paidOn.getTime());
  }, [period, monthDate, completed]);

  const today = new Date();
  const isCurrentWeek = isInPayWeek(today.toISOString(), week);

  return (
    <div className="space-y-4">
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

      {/* Навигатор периода */}
      {period === 'week' && (
        <div className="flex items-center justify-between bg-ink-900 rounded-xl border border-white/5 px-2 py-1.5">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="px-3 py-2 text-slate-300 hover:text-white text-lg"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="font-semibold">{payWeekLabel(week)}</div>
            <div className="text-xs text-brand-400">
              💰 выплата {format(week.paidOn, 'EEEE d MMM', { locale: ru })}
            </div>
          </div>
          <button
            onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
            disabled={weekOffset >= 0}
            className="px-3 py-2 text-slate-300 hover:text-white text-lg disabled:opacity-30"
          >
            ›
          </button>
        </div>
      )}

      {period === 'month' && (
        <div className="flex items-center justify-between bg-ink-900 rounded-xl border border-white/5 px-2 py-1.5">
          <button
            onClick={() => setMonthOffset((o) => o - 1)}
            className="px-3 py-2 text-slate-300 hover:text-white text-lg"
          >
            ‹
          </button>
          <div className="font-semibold capitalize">
            {format(monthDate, 'LLLL yyyy', { locale: ru })}
          </div>
          <button
            onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
            disabled={monthOffset >= 0}
            className="px-3 py-2 text-slate-300 hover:text-white text-lg disabled:opacity-30"
          >
            ›
          </button>
        </div>
      )}

      <StatCard
        label={
          period === 'week'
            ? isCurrentWeek
              ? 'Средний ₪/ч · текущая неделя'
              : 'Средний ₪/ч за неделю'
            : 'Средний заработок в час'
        }
        value={formatRate(stats.avgRate)}
        hint={`на основе ${stats.count} ${pluralShifts(stats.count)}`}
        accent
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Всего часов"
          value={stats.totalHours.toLocaleString('he-IL', { maximumFractionDigits: 1 })}
        />
        <StatCard
          label={period === 'week' ? 'К выплате' : 'Всего заработано'}
          value={formatMoney(stats.totalEarnings)}
        />
      </div>

      {period === 'week' && (
        <p className="text-xs text-slate-500">
          Расчётная неделя Wolt: Вт–Пн. Деньги приходят в среду после её закрытия.
          {isCurrentWeek && ' Неделя ещё идёт — сумма копится.'}
        </p>
      )}

      {period === 'month' && monthPayouts.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Выплаты месяца</h2>
          <div className="space-y-2">
            {monthPayouts.map((p) => {
              const paid = p.paidOn.getTime() <= today.getTime();
              return (
                <Card key={p.paidOn.toISOString()} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold capitalize tabular">
                      {format(p.paidOn, 'EEEE d MMM', { locale: ru })}
                    </div>
                    <div className="text-xs text-slate-400">
                      за неделю {p.label} · {paid ? 'зачислено' : 'ожидается'}
                    </div>
                  </div>
                  <div
                    className={[
                      'text-lg font-bold tabular',
                      paid ? 'text-emerald-400' : 'text-brand-400',
                    ].join(' ')}
                  >
                    {formatMoney(p.amount)}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {stats.count === 0 && (
        <p className="text-center text-slate-500 text-sm pt-4">За этот период смен нет.</p>
      )}

      <DataSection />
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
