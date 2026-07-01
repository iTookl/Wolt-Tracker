import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useShifts } from '../hooks/useShifts';
import { usePlannedShifts } from '../hooks/usePlannedShifts';
import { useAppState } from '../state/AppState';
import { buildMonthPlan, overallBaseRate, weekdayStats, type MonthPlan } from '../lib/goal';
import { activeMs, formatHm, ratePerHour, totalEarnings } from '../lib/time';
import { formatMoney, formatRate } from '../lib/money';
import { MonthCalendar, dayKey } from '../components/MonthCalendar';
import { PlannedShiftModal } from '../components/PlannedShiftModal';
import { ShiftDetailModal } from '../components/ShiftDetailModal';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import type { PlannedShift, Shift } from '../types';
import { newId } from '../lib/id';

export function PlanScreen() {
  const { completed, updateShift, deleteShift } = useShifts();
  const { planned, addPlanned, updatePlanned, deletePlanned } = usePlannedShifts();
  const { goals, setGoals } = useAppState();

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlannedShift | null>(null);
  const [draftPlan, setDraftPlan] = useState<PlannedShift | null>(null);
  const [viewShift, setViewShift] = useState<Shift | null>(null);
  const [editTarget, setEditTarget] = useState(false);

  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const wstats = useMemo(() => weekdayStats(completed), [completed]);
  const overall = useMemo(() => overallBaseRate(completed), [completed]);
  const offDays = useMemo(() => new Set(goals.offDays), [goals.offDays]);
  const plan = useMemo(
    () =>
      buildMonthPlan(
        completed,
        planned,
        goals.monthlyTarget,
        monthDate,
        wstats,
        overall,
        offDays
      ),
    [completed, planned, goals.monthlyTarget, monthDate, wstats, overall, offDays]
  );

  const autoMap = useMemo(() => {
    const m = new Map<string, { hours: number }>();
    for (const d of plan.autoDays) m.set(d.dateKey, { hours: d.hours });
    return m;
  }, [plan.autoDays]);

  const monthName = format(monthDate, 'LLLL', { locale: ru });

  const dayShifts = useMemo(
    () =>
      selectedDay
        ? completed.filter((s) => dayKey(new Date(s.startedAt)) === selectedDay)
        : [],
    [completed, selectedDay]
  );
  const dayPlans = useMemo(
    () => (selectedDay ? planned.filter((p) => p.date === selectedDay) : []),
    [planned, selectedDay]
  );
  const dayAuto = selectedDay ? plan.autoByDay.get(selectedDay) : undefined;
  const dayOff = selectedDay ? offDays.has(selectedDay) : false;

  function makeDraftFor(date: string): PlannedShift {
    return { id: newId(), date, plannedStart: '18:00', plannedEnd: '23:00', targetEarnings: null };
  }
  function saveTarget(v: number | null) {
    setGoals((g) => ({ ...g, monthlyTarget: v }));
    setEditTarget(false);
  }
  function toggleOff(date: string) {
    setGoals((g) => {
      const set = new Set(g.offDays);
      if (set.has(date)) set.delete(date);
      else set.add(date);
      return { ...g, offDays: [...set] };
    });
  }

  const hasTarget = goals.monthlyTarget != null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">План</h1>

      {!hasTarget || editTarget ? (
        <TargetEditor
          current={goals.monthlyTarget}
          monthName={monthName}
          onSave={saveTarget}
          onCancel={hasTarget ? () => setEditTarget(false) : undefined}
        />
      ) : (
        <GoalCard plan={plan} monthName={monthName} onEdit={() => setEditTarget(true)} />
      )}

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

      {hasTarget && !plan.reached && <WeeksBreakdown plan={plan} />}

      <MonthCalendar
        monthDate={monthDate}
        plans={planned}
        shifts={completed}
        autoDays={autoMap}
        offDays={offDays}
        selected={selectedDay}
        onSelectDay={(k) => setSelectedDay(k)}
      />

      <p className="text-xs text-slate-500">
        Тапни день: отметить выходной, добавить/изменить смену или посмотреть факт. «Nч» —
        рекомендованная длина смены под цель (сильные дни длиннее). Ручная смена или выходной
        фиксируют день — остальные пересчитываются под цель.
      </p>

      {/* Лист дня */}
      {selectedDay && (
        <Modal
          open={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          title={capitalize(
            format(new Date(`${selectedDay}T00:00`), 'EEEE, d MMMM', { locale: ru })
          )}
        >
          <div className="space-y-4">
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

            {dayAuto && !dayOff && dayShifts.length === 0 && dayPlans.length === 0 && (
              <div className="rounded-xl bg-brand-500/5 border border-brand-500/20 p-3 text-sm">
                🎯 Под цель: <b className="tabular">{dayAuto.hours} ч</b> ·{' '}
                <span className="tabular">≈ {formatMoney(Math.round(dayAuto.expected))}</span>
                <div className="text-xs text-slate-400 mt-0.5">
                  Рекомендация. Можешь закрепить сменой (задать точное время) или сделать день
                  выходным — остальные дни пересчитаются.
                </div>
              </div>
            )}

            <section>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Планы</h3>
              {dayPlans.length === 0 ? (
                <p className="text-sm text-slate-500">На этот день планов нет.</p>
              ) : (
                <div className="space-y-2">
                  {dayPlans.map((p) => (
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
                      <span className="text-xs text-brand-400">изменить</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <div className="space-y-2">
              <Button full size="lg" onClick={() => setDraftPlan(makeDraftFor(selectedDay))}>
                + Смена на этот день
              </Button>
              {dayShifts.length === 0 && (
                <button
                  onClick={() => toggleOff(selectedDay)}
                  className="w-full text-center text-sm text-slate-400 hover:text-slate-200 py-2"
                >
                  {dayOff ? '↩ Вернуть в план' : '🚫 Сделать выходным'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {editingPlan && (
        <PlannedShiftModal
          open={!!editingPlan}
          planned={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSave={(patch) => updatePlanned(editingPlan.id, { ...patch, auto: false })}
          onDelete={() => deletePlanned(editingPlan.id)}
        />
      )}

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

function GoalCard({
  plan,
  monthName,
  onEdit,
}: {
  plan: MonthPlan;
  monthName: string;
  onEdit: () => void;
}) {
  const target = plan.target ?? 0;
  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Цель · <span className="capitalize">{monthName}</span>
          </div>
          <div className="text-2xl font-bold tabular">{formatMoney(target)}</div>
        </div>
        <button
          onClick={onEdit}
          className="text-sm text-brand-400 hover:text-brand-300 py-1"
        >
          Изменить
        </button>
      </div>

      <div className="h-2.5 rounded-full bg-ink-800 overflow-hidden">
        <div
          className={['h-full rounded-full', plan.reached ? 'bg-emerald-500' : 'bg-brand-500'].join(
            ' '
          )}
          style={{ width: `${Math.round(plan.progress * 100)}%` }}
        />
      </div>
      <div className="text-xs text-slate-400 tabular">
        {formatMoney(plan.earned)} факт
        {plan.manualPlanned > 0 && ` + ${formatMoney(Math.round(plan.manualPlanned))} план`} из{' '}
        {formatMoney(target)}
      </div>

      {plan.reached ? (
        <div className="text-sm text-emerald-400">🎉 Цель закрыта — дальше чистый плюс.</div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">
            Осталось <b className="tabular">{formatMoney(plan.remaining)}</b>
          </span>
          <span className="text-brand-400 tabular">
            нужно ≈ {formatMoney(plan.perWeekNeed)}/нед
          </span>
        </div>
      )}

      {!plan.hasHistory && !plan.reached && (
        <div className="text-xs text-amber-300">
          Пока нет завершённых смен с заработком — график построится, когда накопится статистика.
        </div>
      )}
      {plan.hasHistory && !plan.reached && plan.workDays > 0 && (
        <div className="text-xs text-slate-400">
          Чтобы дойти: ~<b className="text-slate-200 tabular">{plan.totalHours} ч</b> за{' '}
          <span className="tabular">{plan.workDays} дн</span> · ≈
          <span className="tabular">{Math.round(plan.totalHours / plan.workDays)} ч/день</span>
          {!plan.feasible && (
            <span className="text-rose-300">
              {' '}
              — даже так не хватает ~{Math.ceil(plan.shortfallHours)} ч: свободных дней в месяце в
              обрез.
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function TargetEditor({
  current,
  monthName,
  onSave,
  onCancel,
}: {
  current: number | null;
  monthName: string;
  onSave: (v: number | null) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(current?.toString() ?? '');
  function commit() {
    const n = value.trim() === '' ? null : Number(value.replace(',', '.'));
    onSave(n != null && Number.isFinite(n) && n > 0 ? n : null);
  }
  return (
    <Card className="space-y-3">
      <label className="block">
        <span className="text-sm text-slate-300">
          Цель на <span className="capitalize">{monthName}</span> с чаевыми (как в Wolt), ₪
        </span>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          placeholder="например, 12000"
          className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-xl font-bold tabular outline-none focus:border-brand-500"
        />
      </label>
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="subtle" className="flex-1" onClick={onCancel}>
            Отмена
          </Button>
        )}
        <Button variant="primary" className="flex-1" onClick={commit}>
          Сохранить
        </Button>
      </div>
    </Card>
  );
}

function WeeksBreakdown({ plan }: { plan: MonthPlan }) {
  return (
    <section className="space-y-1.5">
      <h2 className="font-semibold text-sm">Недели Wolt</h2>
      <Card className="p-0 divide-y divide-white/5">
        {plan.weeks.map((w, i) => {
          const prog =
            w.planned > 0 ? Math.min(1, w.earned / w.planned) : w.earned > 0 ? 1 : 0;
          return (
            <div key={i} className="px-4 py-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="tabular">{w.label}</span>
                <span className="tabular text-slate-400">
                  <span className="text-emerald-400">{formatMoney(w.earned)}</span> /{' '}
                  {formatMoney(w.planned)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[11px] text-brand-400/80 tabular">
                  💰 {format(w.paidOn, 'EEE d MMM', { locale: ru })}
                </span>
              </div>
              <div className="h-1.5 mt-1 rounded-full bg-ink-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.round(prog * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </Card>
      <p className="text-[11px] text-slate-500">
        Факт / план по расчётным неделям Wolt (Вт→Пн). 💰 — когда придут деньги за неделю.
      </p>
    </section>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
