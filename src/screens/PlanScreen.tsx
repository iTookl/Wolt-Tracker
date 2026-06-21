import { useMemo, useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { usePlannedShifts } from '../hooks/usePlannedShifts';
import { computeStats, estimatePlannedEarnings } from '../lib/stats';
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
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import type { PlannedShift, Shift } from '../types';
import { newId } from '../lib/id';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export function PlanScreen() {
  const { completed, updateShift, deleteShift } = useShifts();
  const { planned, addPlanned, updatePlanned, deletePlanned } = usePlannedShifts();

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
        <h1 className="text-2xl font-bold">Планы</h1>
        <Button
          size="md"
          variant="subtle"
          onClick={() => setDraftPlan(makeDraftFor(selectedDay ?? dayKey(new Date())))}
        >
          + План
        </Button>
      </div>

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
          onSave={(patch) => updatePlanned(editingPlan.id, patch)}
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
