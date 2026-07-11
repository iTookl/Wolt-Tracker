import { useMemo } from 'react';
import { useShifts } from '../hooks/useShifts';
import { computeStats, LOW_DATA_THRESHOLD, type SlotStat } from '../lib/stats';
import { SlotBarChart } from '../components/SlotBarChart';
import { Card } from '../components/ui/Card';
import { formatRate } from '../lib/money';
import { useI18n } from '../i18n/I18nProvider';
import type { Translations } from '../i18n/dict';

type SlotKey = keyof Translations['slots'];

/** Локализация меток слотов времени суток (ключ стабилен: morning/noon/…). */
const trSlot = (t: Translations, s: SlotStat): SlotStat => ({
  ...s,
  label: t.slots[s.key as SlotKey] ?? s.label,
});
/** Локализация дней недели: ключ — номер дня 0..6. */
const trWeekday = (t: Translations, s: SlotStat): SlotStat => ({
  ...s,
  label: t.weekdays[Number(s.key)] ?? s.label,
});

export function StatsScreen() {
  const { t, lang } = useI18n();
  const { completed } = useShifts();
  const stats = useMemo(() => computeStats(completed), [completed]);

  if (stats.totalShifts === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-5xl mb-3">📈</div>
        <p className="text-slate-400">{t.stats.emptyTitle}</p>
        <p className="text-slate-500 text-sm mt-1">{t.stats.emptyHint}</p>
      </div>
    );
  }

  // Лучший слот по времени суток (среди тех, где данных достаточно).
  const bestSlot = stats.byTimeOfDay
    .filter((s) => s.rate != null && s.shiftCount >= LOW_DATA_THRESHOLD)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];

  return (
    <div className="space-y-5">
      <p className="text-slate-400 text-sm">{t.stats.avgOverHistory(stats.totalShifts)}</p>

      {stats.totalShifts < 5 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3">
          {t.stats.lowDataWarning}
        </div>
      )}

      {bestSlot && (
        <Card className="border-brand-500/30 bg-brand-500/5">
          <div className="text-xs uppercase tracking-wide text-slate-400">{t.stats.bestSlot}</div>
          <div className="mt-1 text-xl font-bold">
            {t.slots[bestSlot.key as SlotKey] ?? bestSlot.label}{' '}
            <span className="text-slate-400 font-normal">{bestSlot.hint}</span>
          </div>
          <div className="text-brand-400 font-bold tabular">{formatRate(bestSlot.rate, lang)}</div>
        </Card>
      )}

      <section>
        <h2 className="font-semibold mb-2">{t.stats.byWeekday}</h2>
        <Card className="px-1 py-3">
          <SlotBarChart data={stats.byWeekday.map((s) => trWeekday(t, s))} />
        </Card>
      </section>

      <section>
        <h2 className="font-semibold mb-2">{t.stats.byTimeOfDay}</h2>
        <Card className="px-1 py-3">
          <SlotBarChart data={stats.byTimeOfDay.map((s) => trSlot(t, s))} />
        </Card>
      </section>

      <p className="text-xs text-slate-500 leading-relaxed">{t.stats.footnote(LOW_DATA_THRESHOLD)}</p>
    </div>
  );
}
