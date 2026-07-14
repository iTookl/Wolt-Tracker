import { useState } from 'react';
import { format } from 'date-fns';
import { useI18n } from '../i18n/I18nProvider';
import { useAppState } from '../state/AppState';
import {
  addCutoff,
  currentCutoff,
  hasPayoutSetup,
  needsNextCutoff,
  payPeriodLabel,
  payPeriodOf,
  removeCutoff,
  suggestNextCutoff,
} from '../lib/payout';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

/**
 * Даты выплат Wolt. Пользователь вписывает дату из приложения Wolt
 * («Next payout after 15 jul») — это конец расчётного периода. От введённых дат
 * считаются периоды, календарь, разбивка на «Плане» и кассовый месяц.
 */
export function PayoutCard() {
  const { t, locale } = useI18n();
  const { payouts, setPayouts } = useAppState();
  const [editing, setEditing] = useState(false);

  const now = new Date();
  const needsDate = needsNextCutoff(payouts, now);
  const period = payPeriodOf(now, payouts);
  const cutoffKey = format(currentCutoff(payouts, now), 'yyyy-MM-dd');
  // Если конец текущего периода — вписанная дата, «Изменить» правит её, а не плодит новую.
  const replacing = payouts.cutoffs.includes(cutoffKey) ? cutoffKey : null;
  const lastEntered = payouts.cutoffs[payouts.cutoffs.length - 1] ?? null;

  function save(value: string) {
    if (!value) return;
    setPayouts((cfg) => addCutoff(replacing ? removeCutoff(cfg, replacing) : cfg, value));
    setEditing(false);
  }

  if (editing || needsDate) {
    return (
      <CutoffEditor
        initial={editing && replacing ? replacing : suggestNextCutoff(payouts, now)}
        closedDate={
          !editing && hasPayoutSetup(payouts) && lastEntered
            ? format(new Date(`${lastEntered}T00:00`), 'd MMM', { locale })
            : null
        }
        onSave={save}
        onCancel={editing ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <Card className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {t.payoutCard.title}
          </div>
          <div className="text-lg font-bold tabular">
            {t.payoutCard.nextPayout(format(period.end, 'd MMM', { locale }))}
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-brand-400 hover:text-brand-300 py-1 shrink-0"
        >
          {t.payoutCard.editWord}
        </button>
      </div>
      <div className="text-xs text-slate-400 tabular">
        {t.payoutCard.currentPeriod(payPeriodLabel(period, locale))}
      </div>
    </Card>
  );
}

function CutoffEditor({
  initial,
  closedDate,
  onSave,
  onCancel,
}: {
  initial: string;
  closedDate: string | null; // период закрылся — подсказываем, какой именно
  onSave: (value: string) => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);

  return (
    <Card className="space-y-3">
      <div>
        <div className="font-semibold">{t.payoutCard.askTitle}</div>
        <p className="text-xs text-slate-400 mt-0.5">
          {closedDate ? t.payoutCard.periodClosed(closedDate) : t.payoutCard.askHint}
        </p>
      </div>
      <label className="block">
        <span className="text-sm text-slate-300">{t.payoutCard.dateLabel}</span>
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-lg font-semibold tabular outline-none focus:border-brand-500"
        />
      </label>
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="subtle" className="flex-1" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        )}
        <Button variant="primary" className="flex-1" onClick={() => onSave(value)}>
          {t.common.save}
        </Button>
      </div>
    </Card>
  );
}
