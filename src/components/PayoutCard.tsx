import { useState } from 'react';
import { format } from 'date-fns';
import { useI18n } from '../i18n/I18nProvider';
import { useAppState } from '../state/AppState';
import { payPeriodLabel, payPeriodOf } from '../lib/payout';
import { saveNextPayout, validatePayoutDate, type PayoutDateError } from '../lib/payoutDate';
import { usePayoutStatus } from '../hooks/usePayoutStatus';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

/** «15 июл» из `YYYY-MM-DD` (полдень — чтобы TZ устройства не сдвинул день). */
export function useDateLabel() {
  const { locale } = useI18n();
  return (key: string) => format(new Date(`${key}T12:00`), 'd MMM', { locale });
}

/**
 * Дата следующей выплаты Wolt — только то, что вписал пользователь
 * («Next payout after 15 jul»). Никаких догадок и подстановок «+7 дней».
 */
export function PayoutCard() {
  const { t, locale } = useI18n();
  const { payouts } = useAppState();
  const status = usePayoutStatus();
  const label = useDateLabel();
  const [editing, setEditing] = useState(false);

  if (editing || status.kind !== 'upcoming') {
    return (
      <PayoutDateEditor
        initial={editing && status.kind === 'upcoming' ? status.date : ''}
        hint={status.kind === 'passed' ? t.payoutCard.periodClosed(label(status.date)) : t.payoutCard.askHint}
        onDone={() => setEditing(false)}
        onCancel={editing ? () => setEditing(false) : undefined}
      />
    );
  }

  const period = payPeriodOf(new Date(`${status.date}T12:00`), payouts);
  return (
    <Card className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {t.payoutCard.title}
          </div>
          <div className="text-lg font-bold tabular">
            {t.payoutCard.nextPayout(label(status.date))}
          </div>
          <div className="text-sm text-brand-400">{t.payoutCard.countdown(status.daysLeft)}</div>
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

/** Поле ввода даты с валидацией (пусто / некорректно / в прошлом). */
export function PayoutDateForm({
  initial,
  onDone,
  onCancel,
  cancelLabel,
}: {
  initial: string;
  onDone: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const { t } = useI18n();
  const { setPayouts } = useAppState();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<PayoutDateError | null>(null);

  const errorText: Record<PayoutDateError, string> = {
    empty: t.payoutCard.errEmpty,
    invalid: t.payoutCard.errInvalid,
    past: t.payoutCard.errPast,
  };

  function save() {
    const now = new Date();
    const err = validatePayoutDate(value, now);
    setError(err);
    if (err) return;
    setPayouts((cfg) => saveNextPayout(cfg, value, now));
    onDone();
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm text-slate-300">{t.payoutCard.dateLabel}</span>
        <input
          type="date"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          className={[
            'mt-1 w-full rounded-xl bg-ink-800 border px-4 py-3 text-lg font-semibold tabular outline-none focus:border-brand-500',
            error ? 'border-rose-500' : 'border-white/10',
          ].join(' ')}
        />
        {error && <span className="mt-1 block text-sm text-rose-400">{errorText[error]}</span>}
      </label>
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="subtle" className="flex-1" onClick={onCancel}>
            {cancelLabel ?? t.common.cancel}
          </Button>
        )}
        <Button variant="primary" className="flex-1" onClick={save}>
          {t.common.save}
        </Button>
      </div>
    </div>
  );
}

function PayoutDateEditor({
  initial,
  hint,
  onDone,
  onCancel,
}: {
  initial: string;
  hint: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="space-y-3">
      <div>
        <div className="font-semibold">{t.payoutCard.askTitle}</div>
        <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
      </div>
      <PayoutDateForm initial={initial} onDone={onDone} onCancel={onCancel} />
    </Card>
  );
}
