import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppState } from '../state/AppState';
import { useShifts } from '../hooks/useShifts';
import { Card, StatCard } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { formatMoney, formatRate } from '../lib/money';
import { payWeekLabel, payWeekOf } from '../lib/payout';
import {
  buildGoalPlan,
  currentPeriod,
  overallBaseRate,
  weekdayStats,
  MAX_HOURS_PER_DAY,
  type GoalPeriodKind,
} from '../lib/goal';

const tabs: { id: GoalPeriodKind; label: string }[] = [
  { id: 'month', label: 'Месяц' },
  { id: 'week', label: 'Неделя' },
];

export function GoalScreen() {
  const { completed } = useShifts();
  const { goals, setGoals } = useAppState();
  const [kind, setKind] = useState<GoalPeriodKind>('month');

  const target = kind === 'month' ? goals.monthlyTarget : goals.weeklyTarget;

  const period = useMemo(() => currentPeriod(kind), [kind]);
  const wstats = useMemo(() => weekdayStats(completed), [completed]);
  const overall = useMemo(() => overallBaseRate(completed), [completed]);
  const plan = useMemo(
    () => buildGoalPlan(completed, target, period, wstats, overall),
    [completed, target, period, wstats, overall]
  );

  const periodLabel =
    kind === 'month'
      ? format(period.start, 'LLLL yyyy', { locale: ru })
      : payWeekLabel(payWeekOf(new Date()));

  function saveTarget(value: number | null) {
    setGoals((g) =>
      kind === 'month' ? { ...g, monthlyTarget: value } : { ...g, weeklyTarget: value }
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Цель</h1>

      <div className="grid grid-cols-2 gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setKind(t.id)}
            className={[
              'min-h-[44px] rounded-xl text-sm font-medium transition-colors',
              t.id === kind
                ? 'bg-brand-500 text-white'
                : 'bg-ink-800 text-slate-300 hover:bg-ink-700',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-sm text-slate-400 capitalize">{periodLabel}</div>

      <TargetCard
        key={kind}
        target={target}
        onSave={saveTarget}
        progressLabel={
          target != null
            ? `${formatMoney(plan.earned)} из ${formatMoney(target)}`
            : undefined
        }
        progress={plan.progress}
        reached={plan.reached}
      />

      {target != null && (
        <>
          {plan.reached ? (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <div className="font-semibold text-emerald-400">🎉 Цель достигнута!</div>
              <p className="text-sm text-slate-300 mt-1">
                Уже {formatMoney(plan.earned)} по базе. Дальше — чистый плюс, можно снизить
                часы или копить с запасом.
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Осталось" value={formatMoney(plan.remaining)} accent />
                <PaceCard paceDelta={plan.paceDelta} />
              </div>

              {!plan.hasHistory ? (
                <Card className="border-amber-500/30 bg-amber-500/5 text-sm text-amber-200">
                  Пока нет завершённых смен с заработком — не на чем строить план. Заверши
                  несколько смен, и трекер начнёт раскидывать часы по дням.
                </Card>
              ) : (
                <>
                  {!plan.feasible && (
                    <Card className="border-rose-500/30 bg-rose-500/5 text-sm text-rose-200">
                      ⚠️ При потолке {MAX_HOURS_PER_DAY} ч/день цель впритык недостижима:
                      не хватает примерно {Math.ceil(plan.shortfallHours)} ч. Подними цель
                      реалистичнее или работай больше часов.
                    </Card>
                  )}
                  <ScheduleSection plan={plan} />
                </>
              )}
            </>
          )}
        </>
      )}

      <WeekdayAdvice stats={wstats} />
    </div>
  );
}

interface TargetCardProps {
  target: number | null;
  onSave: (value: number | null) => void;
  progressLabel?: string;
  progress: number;
  reached: boolean;
}

function TargetCard({ target, onSave, progressLabel, progress, reached }: TargetCardProps) {
  const [editing, setEditing] = useState(target == null);
  const [value, setValue] = useState(target?.toString() ?? '');

  function commit() {
    const n = value.trim() === '' ? null : Number(value.replace(',', '.'));
    onSave(n != null && Number.isFinite(n) && n > 0 ? n : null);
    setEditing(false);
  }

  if (editing) {
    return (
      <Card className="space-y-3">
        <label className="block">
          <span className="text-sm text-slate-300">Цель по базе (без чаевых), ₪</span>
          <input
            type="number"
            inputMode="decimal"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            placeholder="например, 11000"
            className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-xl font-bold tabular outline-none focus:border-brand-500"
          />
        </label>
        <div className="flex gap-3">
          {target != null && (
            <Button variant="subtle" className="flex-1" onClick={() => setEditing(false)}>
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

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Цель</div>
          <div className="text-2xl font-bold tabular">{formatMoney(target)}</div>
        </div>
        <button
          onClick={() => {
            setValue(target?.toString() ?? '');
            setEditing(true);
          }}
          className="text-sm text-brand-400 hover:text-brand-300 py-1"
        >
          Изменить
        </button>
      </div>
      <div className="h-2.5 rounded-full bg-ink-800 overflow-hidden">
        <div
          className={['h-full rounded-full', reached ? 'bg-emerald-500' : 'bg-brand-500'].join(
            ' '
          )}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      {progressLabel && <div className="text-xs text-slate-400 tabular">{progressLabel}</div>}
    </Card>
  );
}

function PaceCard({ paceDelta }: { paceDelta: number }) {
  const ahead = paceDelta >= 0;
  const abs = Math.abs(Math.round(paceDelta));
  return (
    <StatCard
      label="Темп"
      value={ahead ? `+${formatMoney(abs)}` : `−${formatMoney(abs)}`}
      hint={ahead ? 'опережаешь график' : 'отстаёшь от графика'}
    />
  );
}

function ScheduleSection({ plan }: { plan: ReturnType<typeof buildGoalPlan> }) {
  if (plan.days.length === 0) {
    return (
      <Card className="text-sm text-slate-400">
        Свободных дней до конца периода нет, либо остаток уже закрыт другими сменами.
      </Card>
    );
  }
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Рекомендованный график</h2>
        <span className="text-xs text-slate-500 tabular">
          {plan.recommendedHours} ч · {plan.days.length}{' '}
          {plan.days.length === 1 ? 'день' : 'дн.'}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        Сильные дни первыми, по {MAX_HOURS_PER_DAY} ч. Прогноз ~
        {formatMoney(plan.projectedEarnings)} к концу периода.
      </p>
      <div className="space-y-2">
        {plan.days.map((d) => (
          <Card
            key={d.date.toISOString()}
            className="flex items-center justify-between py-3"
          >
            <div>
              <div className="font-semibold capitalize tabular">
                {format(d.date, 'EEE, d MMM', { locale: ru })}
              </div>
              <div className="text-xs text-slate-400 tabular">
                {d.hours} ч · {formatRate(d.ratePerHour)}
                {d.lowData && <span className="text-amber-400/80"> · мало данных</span>}
              </div>
            </div>
            <div className="text-lg font-bold tabular text-brand-400">
              ~{formatMoney(d.expected)}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function WeekdayAdvice({ stats }: { stats: ReturnType<typeof weekdayStats> }) {
  const withData = stats
    .filter((s) => s.ratePerHour != null)
    .sort((a, b) => (b.ratePerHour ?? 0) - (a.ratePerHour ?? 0));
  const noData = stats.filter((s) => s.ratePerHour == null);

  if (withData.length === 0) return null;

  return (
    <section className="space-y-2 pt-2">
      <h2 className="font-semibold">Какие дни выгоднее</h2>
      <p className="text-xs text-slate-500">
        По твоей истории. Слева — сколько в среднем приносит день, справа — ставка в час.
      </p>
      <Card className="divide-y divide-white/5 p-0">
        {withData.map((s, i) => (
          <div
            key={s.weekday}
            className={[
              'flex items-center justify-between px-4 py-2.5',
              s.lowData ? 'opacity-50' : '',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              {i === 0 && <span title="Самый выгодный день">🔥</span>}
              <span className="font-semibold">{s.label}</span>
              {s.lowData && (
                <span className="text-[10px] text-amber-400/80">мало данных</span>
              )}
            </div>
            <div className="flex items-baseline gap-3 tabular">
              <span className="font-semibold">{formatMoney(s.avgPerDay)}/день</span>
              <span className="text-sm text-slate-400">{formatRate(s.ratePerHour)}</span>
            </div>
          </div>
        ))}
        {noData.length > 0 && (
          <div className="px-4 py-2 text-xs text-slate-500">
            Нет данных: {noData.map((s) => s.label).join(', ')}
          </div>
        )}
      </Card>
    </section>
  );
}
