import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useI18n } from '../i18n/I18nProvider';
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
  const { t, locale, lang } = useI18n();
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
        offDays,
        new Date(),
        locale
      ),
    [completed, planned, goals.monthlyTarget, monthDate, wstats, overall, offDays, locale]
  );

  const autoMap = useMemo(() => {
    const m = new Map<string, { hours: number }>();
    for (const d of plan.autoDays) m.set(d.dateKey, { hours: d.hours });
    return m;
  }, [plan.autoDays]);
  const restSet = useMemo(() => new Set(plan.restDays), [plan.restDays]);

  const monthName = format(monthDate, 'LLLL', { locale });

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
  const dayRest = selectedDay ? restSet.has(selectedDay) : false;

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
      <h1 className="text-2xl font-bold">{t.plan.title}</h1>

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
          {format(monthDate, 'LLLL yyyy', { locale })}
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
        restDays={restSet}
        selected={selectedDay}
        onSelectDay={(k) => setSelectedDay(k)}
      />

      <p className="text-xs text-slate-500">{t.plan.calendarHint}</p>

      {/* Лист дня */}
      {selectedDay && (
        <Modal
          open={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          title={capitalize(
            format(new Date(`${selectedDay}T00:00`), 'EEEE, d MMMM', { locale })
          )}
        >
          <div className="space-y-4">
            {dayShifts.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">{t.plan.worked}</h3>
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
                        {formatRate(ratePerHour(s), lang)}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {dayAuto && !dayOff && dayShifts.length === 0 && dayPlans.length === 0 && (
              <div className="rounded-xl bg-brand-500/5 border border-brand-500/20 p-3 text-sm">
                🎯 {t.plan.goalDay}: <b className="tabular">{dayAuto.hours} {t.units.hour}</b> ·{' '}
                <span className="tabular">≈ {formatMoney(Math.round(dayAuto.expected))}</span>
                <div className="text-xs text-slate-400 mt-0.5">{t.plan.recommendationNote}</div>
              </div>
            )}

            {dayRest && dayShifts.length === 0 && dayPlans.length === 0 && (
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 text-sm text-emerald-200">
                {t.plan.restNote}
              </div>
            )}

            <section>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">{t.plan.plansHeading}</h3>
              {dayPlans.length === 0 ? (
                <p className="text-sm text-slate-500">{t.plan.noPlans}</p>
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
                            ? t.plan.planGoal(formatMoney(p.targetEarnings))
                            : t.plan.noGoal}
                        </div>
                      </div>
                      <span className="text-xs text-brand-400">{t.plan.editWord}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <div className="space-y-2">
              <Button full size="lg" onClick={() => setDraftPlan(makeDraftFor(selectedDay))}>
                {t.plan.addShiftForDay}
              </Button>
              {dayShifts.length === 0 && (
                <button
                  onClick={() => toggleOff(selectedDay)}
                  className="w-full text-center text-sm text-slate-400 hover:text-slate-200 py-2"
                >
                  {dayOff ? t.plan.returnToPlan : t.plan.makeOff}
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
  const { t } = useI18n();
  const target = plan.target ?? 0;
  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {t.plan.goalWord} · <span className="capitalize">{monthName}</span>
          </div>
          <div className="text-2xl font-bold tabular">{formatMoney(target)}</div>
        </div>
        <button
          onClick={onEdit}
          className="text-sm text-brand-400 hover:text-brand-300 py-1"
        >
          {t.common.edit}
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
        {formatMoney(plan.earned)} {t.plan.factLabel}
        {plan.manualPlanned > 0 &&
          ` + ${formatMoney(Math.round(plan.manualPlanned))} ${t.plan.planLabel}`}{' '}
        / {formatMoney(target)}
      </div>

      {plan.reached ? (
        <div className="text-sm text-emerald-400">{t.plan.goalReached}</div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">
            {t.plan.remainingLabel} <b className="tabular">{formatMoney(plan.remaining)}</b>
          </span>
          <span className="text-brand-400 tabular">
            {t.plan.perWeekNeed(formatMoney(plan.perWeekNeed))}
          </span>
        </div>
      )}

      {!plan.hasHistory && !plan.reached && (
        <div className="text-xs text-amber-300">{t.plan.noHistoryNote}</div>
      )}
      {plan.hasHistory && !plan.reached && plan.workDays > 0 && (
        <div className="text-xs text-slate-400">
          {t.plan.reachPrefix}
          <b className="text-slate-200 tabular">{plan.totalHours} {t.units.hour}</b> {t.plan.reachOver}{' '}
          <span className="tabular">{plan.workDays} {t.units.day}</span> · ≈
          <span className="tabular">
            {Math.round(plan.totalHours / plan.workDays)} {t.units.perDay}
          </span>
          {!plan.feasible && (
            <span className="text-rose-300">{t.plan.shortfall(Math.ceil(plan.shortfallHours))}</span>
          )}
        </div>
      )}
      {plan.hasHistory && plan.restDays.length > 0 && (
        <div className="text-xs text-emerald-300/90">{t.plan.canRest(plan.restDays.length)}</div>
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
  const { t } = useI18n();
  const [value, setValue] = useState(current?.toString() ?? '');
  function commit() {
    const n = value.trim() === '' ? null : Number(value.replace(',', '.'));
    onSave(n != null && Number.isFinite(n) && n > 0 ? n : null);
  }
  return (
    <Card className="space-y-3">
      <label className="block">
        <span className="text-sm text-slate-300">
          {t.plan.targetForPre}
          <span className="capitalize">{monthName}</span>
          {t.plan.targetForPost}
        </span>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.plan.targetPlaceholder}
          className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-xl font-bold tabular outline-none focus:border-brand-500"
        />
      </label>
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="subtle" className="flex-1" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        )}
        <Button variant="primary" className="flex-1" onClick={commit}>
          {t.common.save}
        </Button>
      </div>
    </Card>
  );
}

function WeeksBreakdown({ plan }: { plan: MonthPlan }) {
  const { t, locale } = useI18n();
  return (
    <section className="space-y-1.5">
      <h2 className="font-semibold text-sm">{t.plan.weeksTitle}</h2>
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
                  💰 {format(w.paidOn, 'EEE d MMM', { locale })}
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
      <p className="text-[11px] text-slate-500">{t.plan.weeksFootnote}</p>
    </section>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
