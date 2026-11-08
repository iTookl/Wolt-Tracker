import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { usePayoutStatus } from '../hooks/usePayoutStatus';
import { PayoutDateForm, useDateLabel } from './PayoutCard';
import { Card } from './ui/Card';

/**
 * Ненавязчивый баннер над любой вкладкой: сохранённая дата выплаты прошла
 * (по Израилю) → просим вписать следующую. «Позже» скрывает его до следующего
 * запуска приложения (состояние только в памяти, ничего не пишется в storage).
 */
export function PayoutReminder() {
  const { t } = useI18n();
  const status = usePayoutStatus();
  const label = useDateLabel();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (status.kind !== 'passed' || dismissedFor === status.date) return null;

  return (
    <Card className="mb-3 space-y-3 border-amber-500/30 bg-amber-500/5">
      <div>
        <div className="font-semibold">{t.payoutCard.reminderTitle(label(status.date))}</div>
        <p className="text-xs text-slate-400 mt-0.5">{t.payoutCard.reminderText}</p>
      </div>
      <PayoutDateForm
        initial=""
        onDone={() => undefined}
        onCancel={() => setDismissedFor(status.date)}
        cancelLabel={t.payoutCard.later}
      />
    </Card>
  );
}
