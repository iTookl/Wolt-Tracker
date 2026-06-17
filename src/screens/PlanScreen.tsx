import { useMemo, useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { usePlannedShifts } from '../hooks/usePlannedShifts';
import { computeStats, estimatePlannedEarnings } from '../lib/stats';
import { plannedRange } from '../lib/time';
import { formatMoney } from '../lib/money';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PlannedShiftModal } from '../components/PlannedShiftModal';
import type { PlannedShift } from '../types';
import { newId } from '../lib/id';
import { addDays, format, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

function makeDraft(): PlannedShift {
  return {
    id: newId(),
    date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    plannedStart: '18:00',
    plannedEnd: '23:00',
    targetEarnings: null,
  };
}

function dayHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00`);
  if (isToday(d)) return 'Сегодня';
  if (isTomorrow(d)) return 'Завтра';
  const s = format(d, 'EEEE, d MMM', { locale: ru });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function PlanScreen() {
  const { completed } = useShifts();
  const { planned, addPlanned, updatePlanned, deletePlanned } = usePlannedShifts();
  const [selected, setSelected] = useState<PlannedShift | null>(null);
  const [draft, setDraft] = useState<PlannedShift | null>(null);

  const stats = useMemo(() => computeStats(completed), [completed]);

  // Только сегодня и будущее, сгруппировано по дате.
  const upcoming = useMemo(() => {
    const t = todayStr();
    return planned.filter((p) => p.date >= t);
  }, [planned]);

  const estimateOf = (p: PlannedShift) => {
    const { start, end } = plannedRange(p.date, p.plannedStart, p.plannedEnd);
    return estimatePlannedEarnings(start, end, stats);
  };

  const totals = useMemo(() => {
    let hours = 0;
    let est = 0;
    let target = 0;
    for (const p of upcoming) {
      const e = estimateOf(p);
      hours += e.hours;
      est += e.earnings ?? 0;
      target += p.targetEarnings ?? 0;
    }
    return { hours, est, target };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming, stats]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlannedShift[]>();
    for (const p of upcoming) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    return [...map.entries()];
  }, [upcoming]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Планы</h1>
        <Button size="md" variant="subtle" onClick={() => setDraft(makeDraft())}>
          + План
        </Button>
      </div>

      {upcoming.length > 0 && (
        <Card className="flex justify-between text-center">
          <div>
            <div className="text-xs text-slate-400">Смен</div>
            <div className="text-lg font-bold tabular">{upcoming.length}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Часов</div>
            <div className="text-lg font-bold tabular">
              {totals.hours.toLocaleString('he-IL', { maximumFractionDigits: 1 })}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Ориентир</div>
            <div className="text-lg font-bold text-brand-400 tabular">
              ≈ {formatMoney(Math.round(totals.est))}
            </div>
          </div>
          {totals.target > 0 && (
            <div>
              <div className="text-xs text-slate-400">Цель</div>
              <div className="text-lg font-bold tabular">{formatMoney(totals.target)}</div>
            </div>
          )}
        </Card>
      )}

      {upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-slate-400">Нет запланированных смен.</p>
          <p className="text-slate-500 text-sm mt-1">Добавь план кнопкой «+ План».</p>
        </div>
      ) : (
        grouped.map(([date, items]) => (
          <section key={date}>
            <h2 className="font-semibold text-slate-300 mb-2">{dayHeader(date)}</h2>
            <div className="space-y-2">
              {items.map((p) => {
                const e = estimateOf(p);
                return (
                  <button key={p.id} onClick={() => setSelected(p)} className="w-full text-left">
                    <Card className="flex items-center justify-between active:bg-ink-800 transition-colors">
                      <div>
                        <div className="font-semibold tabular">
                          {p.plannedStart}–{p.plannedEnd}
                          <span className="text-slate-400 font-normal">
                            {' · '}
                            {e.hours.toLocaleString('he-IL', { maximumFractionDigits: 1 })} ч
                          </span>
                        </div>
                        <div className="text-sm text-slate-400 mt-0.5">
                          {p.targetEarnings != null ? `Цель: ${formatMoney(p.targetEarnings)}` : 'Без цели'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">ориентир</div>
                        <div className="text-lg font-bold text-brand-400 tabular">
                          {e.earnings == null ? '—' : `≈ ${formatMoney(Math.round(e.earnings))}`}
                        </div>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {upcoming.length > 0 && (
        <p className="text-xs text-slate-500 leading-relaxed">
          «Ориентир» — грубая прикидка: плановые часы × твой средний ₪/ч по этим слотам. Это не
          обещание заработка, реальность будет отличаться.
          {stats.totalShifts < 5 && ' Пока смен мало — цифры очень приблизительные.'}
        </p>
      )}

      {selected && (
        <PlannedShiftModal
          open={!!selected}
          planned={selected}
          onClose={() => setSelected(null)}
          onSave={(patch) => updatePlanned(selected.id, patch)}
          onDelete={() => deletePlanned(selected.id)}
        />
      )}

      {draft && (
        <PlannedShiftModal
          open={!!draft}
          planned={draft}
          isNew
          onClose={() => setDraft(null)}
          onSave={(patch) => addPlanned({ ...draft, ...patch })}
          onDelete={() => setDraft(null)}
        />
      )}
    </div>
  );
}
