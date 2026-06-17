import { useMemo } from 'react';
import { useShifts } from '../hooks/useShifts';
import { computeStats, LOW_DATA_THRESHOLD } from '../lib/stats';
import { SlotBarChart } from '../components/SlotBarChart';
import { Card } from '../components/ui/Card';
import { formatRate } from '../lib/money';

export function StatsScreen() {
  const { completed } = useShifts();
  const stats = useMemo(() => computeStats(completed), [completed]);

  if (stats.totalShifts === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-5xl mb-3">📈</div>
        <p className="text-slate-400">Пока нет данных для статистики.</p>
        <p className="text-slate-500 text-sm mt-1">
          Заверши несколько смен — появятся средние по слотам.
        </p>
      </div>
    );
  }

  // Лучший слот по времени суток (среди тех, где данных достаточно).
  const bestSlot = stats.byTimeOfDay
    .filter((s) => s.rate != null && s.shiftCount >= LOW_DATA_THRESHOLD)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Слоты</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Средние по твоей истории · {stats.totalShifts}{' '}
          {stats.totalShifts === 1 ? 'смена' : 'смен'}
        </p>
      </div>

      {stats.totalShifts < 5 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3">
          ⚠️ Мало данных — цифры пока нестабильны. Чем больше смен, тем точнее средние.
        </div>
      )}

      {bestSlot && (
        <Card className="border-brand-500/30 bg-brand-500/5">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Самый прибыльный слот
          </div>
          <div className="mt-1 text-xl font-bold">
            {bestSlot.label}{' '}
            <span className="text-slate-400 font-normal">{bestSlot.hint}</span>
          </div>
          <div className="text-brand-400 font-bold tabular">{formatRate(bestSlot.rate)}</div>
        </Card>
      )}

      <section>
        <h2 className="font-semibold mb-2">₪/час по дням недели</h2>
        <Card className="px-1 py-3">
          <SlotBarChart data={stats.byWeekday} />
        </Card>
      </section>

      <section>
        <h2 className="font-semibold mb-2">₪/час по времени суток</h2>
        <Card className="px-1 py-3">
          <SlotBarChart data={stats.byTimeOfDay} />
        </Card>
      </section>

      <p className="text-xs text-slate-500 leading-relaxed">
        Это описательная статистика, а не прогноз. Блёклые столбцы — слоты, где меньше{' '}
        {LOW_DATA_THRESHOLD} смен: им пока не стоит доверять. Длинные смены делятся между
        слотами пропорционально времени.
      </p>
    </div>
  );
}
