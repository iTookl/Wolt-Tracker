import { useMemo, useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { usePlannedShifts } from '../hooks/usePlannedShifts';
import { useAppState } from '../state/AppState';
import { computeStats, estimatePlannedEarnings } from '../lib/stats';
import { earnedBaseInPeriod, periodByOffset } from '../lib/goal';
import {
  activeMs,
  formatHm,
  plannedRange,
  ratePerHour,
  totalEarnings,
} from '../lib/time';
import { formatMoney, formatRate } from '../lib/money';
import { MonthCalendar, dayKey } from '../components/MonthCalendar';
import { PlannedShiftModal } from '../components/PlannedShiftModal';
import { ShiftDetailModal } from '../components/ShiftDetailModal';
import { GoalPanel } from './GoalScreen';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import type { PlannedShift, Shift } from '../types';
import { newId } from '../lib/id';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export function PlanScreen() {
  const { completed, updateShift, deleteShift } = useShifts();
  const { planned, addPlanned, updatePlanned, deletePlanned } = usePlannedShifts();

  const [goalOpen, setGoalOpen] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlannedShift | null>(null);
  const [draftPlan, setDraftPlan] = useState<PlannedShift | null>(null);
  const [viewShift, setViewShift] = useState<Shift | null>(null);

  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const stats = useMemo(() => computeStats(completed), [completed]);

  const dayPlans = useMemo(
    () => (selectedDay ? planned.filter((p) => p.date === selectedDay) : []),
    [planned, selectedDay]
  );
  const dayShifts = useMemo(
    () =>
      selectedDay
        ? completed.filter((s) => dayKey(new Date(s.startedAt)) === selectedDay)
        : [],
    [completed, selectedDay]
  );

  function makeDraftFor(date: string): PlannedShift {
    return {
      id: newId(),
      date,
      plannedStart: '18:00',
      plannedEnd: '23:00',
      targetEarnings: null,
    };
  }

  const estimateOf = (p: PlannedShift) => {
    const { start, end } = plannedRange(p.date, p.plannedStart, p.plannedEnd);
    return estimatePlannedEarnings(start, end, stats);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">План</h1>
        <Button
          size="md"
          variant="subtle"
          onClick={() => setDraftPlan(makeDraftFor(selectedDay ?? dayKey(new Date())))}
        >
          + План
        </Button>
      </div>

      {/* Плашка цели на текущий месяц — тап раскрывает полную панель */}
      <GoalBanner open={goalOpen} onToggle={() => setGoalOpen((o) => !o)} />
      {goalOpen && <GoalPanel />}

      {/* Навигатор месяца */}
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
          onClick={() => setMonthOffset((o) => o + 1)}
          className="px-3 py-2 text-slate-300 hover:text-white text-lg"
        >
          ›
        </button>
      </div>

      <MonthCalendar
        monthDate={monthDate}
        plans={planned}
        shifts={completed}
        selected={selectedDay}
        onSelectDay={(k) => setSelectedDay(k)}
      />

      <p className="text-xs text-slate-500">
        Тапни по дню, чтобы посмотреть смены/планы или добавить план. «Ориентир» по планам —
        грубая оценка из твоих средних ₪/ч.
      </p>

      {/* Лист дня */}
      {selectedDay && (
        <Modal
          open={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          title={capitalize(format(new Date(`${selectedDay}T00:00`), 'EEEE, d MMMM', { locale: ru }))}
        >
          <div className="space-y-4">
            {/* Фактические смены */}
            {dayShifts.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Отработано</h3>
                <div className="space-y-2">
                  {dayShifts.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setViewShift(s)}
                      className="w-full text-left rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-semibold tabular">
                          {format(new Date(s.startedAt), 'HH:mm')}
                          {s.endedAt ? `–${format(new Date(s.endedAt), 'HH:mm')}` : ''}
                        </div>
                        <div className="text-xs text-slate-400 tabular">
                          {formatHm(activeMs(s))} · {formatMoney(totalEarnings(s))}
                        </div>
                      </div>
                      <div className="text-emerald-400 font-bold tabular">
                        {formatRate(ratePerHour(s))}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Планы */}
            <section>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Планы</h3>
              {dayPlans.length === 0 ? (
                <p className="text-sm text-slate-500">На этот день планов нет.</p>
              ) : (
                <div className="space-y-2">
                  {dayPlans.map((p) => {
                    const e = estimateOf(p);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setEditingPlan(p)}
                        className="w-full text-left rounded-xl bg-ink-800 border border-brand-500/20 p-3 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-semibold tabular">
                            {p.plannedStart}–{p.plannedEnd}
                          </div>
                          <div className="text-xs text-slate-400">
                            {p.targetEarnings != null
                              ? `Цель: ${formatMoney(p.targetEarnings)}`
                              : 'Без цели'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-slate-400">ориентир</div>
                          <div className="text-brand-400 font-bold tabular">
                            {e.earnings == null ? '—' : `≈ ${formatMoney(Math.round(e.earnings))}`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <Button full size="lg" onClick={() => setDraftPlan(makeDraftFor(selectedDay))}>
              + Добавить план на этот день
            </Button>
          </div>
        </Modal>
      )}

      {/* Редактирование плана */}
      {editingPlan && (
        <PlannedShiftModal
          open={!!editingPlan}
          planned={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSave={(patch) => updatePlanned(editingPlan.id, { ...patch, auto: false })}
          onDelete={() => deletePlanned(editingPlan.id)}
        />
      )}

      {/* Новый план */}
      {draftPlan && (
        <PlannedShiftModal
          open={!!draftPlan}
          planned={draftPlan}
          isNew
          onClose={() => setDraftPlan(null)}
          onSave={(patch) => addPlanned({ ...draftPlan, ...patch })}
          onDelete={() => setDraftPlan(null)}
        />
      )}

      {/* Просмотр фактической смены */}
      {viewShift && (
        <ShiftDetailModal
          open={!!viewShift}
          shift={viewShift}
          onClose={() => setViewShift(null)}
          onSave={(patch) => updateShift(viewShift.id, patch)}
          onDelete={() => deleteShift(viewShift.id)}
        />
      )}
    </div>
  );
}

/** Компактная плашка месячной цели; тап раскрывает полную панель «Цель». */
function GoalBanner({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { completed } = useShifts();
  const { goals } = useAppState();

  const period = useMemo(() => periodByOffset('month', 0), []);
  const earned = useMemo(
    () => earnedBaseInPeriod(completed, period),
    [completed, period]
  );
  const target = goals.monthlyTarget;
  const monthLabel = format(period.start, 'LLLL', { locale: ru });
  const progress = target != null && target > 0 ? Math.min(1, earned / target) : 0;
  const reached = target != null && earned >= target;

  return (
    <button
      onClick={onToggle}
      className="w-full text-left rounded-2xl bg-ink-900 border border-white/5 p-4"
    >
      {target == null ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">🎯 Поставить цель на месяц</span>
          <span className="text-slate-400 text-sm">{open ? '▴ свернуть' : '▾'}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              🎯 Цель · <span className="capitalize">{monthLabel}</span>
            </span>
            <span className="text-slate-400 text-sm">
              {open ? '▴ свернуть' : '▾ детали'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold tabular">{formatMoney(earned)}</span>
            <span className="text-sm text-slate-400 tabular">из {formatMoney(target)}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-ink-800 overflow-hidden">
            <div
              className={['h-full rounded-full', reached ? 'bg-emerald-500' : 'bg-brand-500'].join(
                ' '
              )}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </>
      )}
    </button>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
