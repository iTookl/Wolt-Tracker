import { useMemo, useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { activeHours, totalEarnings } from '../lib/time';
import { formatMoney, formatRate } from '../lib/money';
import { StatCard, Card } from '../components/ui/Card';
import { DataSection } from '../components/DataSection';
import {
  isInPayPeriod,
  payPeriodLabel,
  payPeriodOf,
  shiftPayPeriod,
} from '../lib/payout';
import {
  format,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { useI18n } from '../i18n/I18nProvider';
import { useAppState } from '../state/AppState';
import type { Shift } from '../types';

type Period = 'week' | 'month' | 'all';

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
  const { t, locale, lang } = useI18n();
  const { completed } = useShifts();
  const { payouts } = useAppState();
  const [period, setPeriod] = useState<Period>('week');
  const periods: { id: Period; label: string }[] = [
    { id: 'week', label: t.summary.week },
    { id: 'month', label: t.summary.month },
    { id: 'all', label: t.summary.all },
  ];
  const [weekOffset, setWeekOffset] = useState(0); // 0 = текущий расчётный период
  const [monthOffset, setMonthOffset] = useState(0);

  const week = useMemo(
    () => shiftPayPeriod(payPeriodOf(new Date(), payouts), weekOffset, payouts),
    [weekOffset, payouts]
  );

  const weekShifts = useMemo(
    () => completed.filter((s) => isInPayPeriod(s.startedAt, week)),
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
    const list: { end: Date; paidOn: Date; label: string; amount: number }[] = [];
    // Перебираем расчётные периоды вокруг месяца.
    for (let i = -1; i <= 5; i++) {
      const w = shiftPayPeriod(payPeriodOf(mStart, payouts), i, payouts);
      if (isWithinInterval(w.paidOn, { start: mStart, end: mEnd })) {
        const amount = completed
          .filter((s) => isInPayPeriod(s.startedAt, w))
          .reduce((sum, s) => sum + (totalEarnings(s) ?? 0), 0);
        list.push({
          end: w.end,
          paidOn: w.paidOn,
          label: payPeriodLabel(w, locale),
          amount,
        });
      }
    }
    return list.sort((a, b) => a.paidOn.getTime() - b.paidOn.getTime());
  }, [period, monthDate, completed, locale, payouts]);

  const today = new Date();
  const isCurrentWeek = isInPayPeriod(today.toISOString(), week);

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
            <div className="font-semibold">{payPeriodLabel(week, locale)}</div>
            <div className="text-xs text-brand-400">
              {t.summary.payoutOn(format(week.end, 'd MMM', { locale }))}
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
            {format(monthDate, 'LLLL yyyy', { locale })}
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
              ? t.summary.avgCurrentWeek
              : t.summary.avgWeek
            : t.summary.avgRate
        }
        value={formatRate(stats.avgRate, lang)}
        hint={t.summary.basedOnShifts(stats.count)}
        accent
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={t.summary.totalHours}
          value={stats.totalHours.toLocaleString('he-IL', { maximumFractionDigits: 1 })}
        />
        <StatCard
          label={period === 'week' ? t.summary.toPayout : t.summary.totalEarned}
          value={formatMoney(stats.totalEarnings)}
        />
      </div>

      {period === 'week' && (
        <p className="text-xs text-slate-500">
          {t.summary.weekNote}
          {isCurrentWeek && t.summary.weekNoteOngoing}
        </p>
      )}

      {period === 'month' && monthPayouts.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">{t.summary.monthPayouts}</h2>
          <div className="space-y-2">
            {monthPayouts.map((p) => {
              const paid = p.paidOn.getTime() <= today.getTime();
              return (
                <Card key={p.paidOn.toISOString()} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold tabular">
                      {t.summary.payoutOn(format(p.end, 'd MMM', { locale }))}
                    </div>
                    <div className="text-xs text-slate-400">
                      {t.summary.forWeek(p.label)} · {paid ? t.summary.credited : t.summary.expected}
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
        <p className="text-center text-slate-500 text-sm pt-4">{t.summary.noShiftsPeriod}</p>
      )}

      <DataSection />
    </div>
  );
}
