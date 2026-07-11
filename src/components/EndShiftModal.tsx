import { useState } from 'react';
import type { EndShiftInput, Shift } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { activeMs, formatDuration, MS_PER_HOUR } from '../lib/time';
import { formatMoney, formatRate } from '../lib/money';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  open: boolean;
  shift: Shift;
  onClose: () => void;
  onConfirm: (input: EndShiftInput, endedAt: string) => void;
}

interface Result {
  durationMs: number;
  earnings: number;
  rate: number | null;
}

export function EndShiftModal({ open, shift, onClose, onConfirm }: Props) {
  const { t, lang } = useI18n();
  // Предзаполняем уже введёнными значениями (важно, когда смена продолжена
  // вторым периодом за день — заработок первого периода не теряется).
  const [earnings, setEarnings] = useState(shift.earnings?.toString() ?? '');
  const [tips, setTips] = useState(shift.tips?.toString() ?? '');
  const [deliveries, setDeliveries] = useState(shift.deliveries?.toString() ?? '');
  const [note, setNote] = useState(shift.note ?? '');
  const [result, setResult] = useState<Result | null>(null);

  // Момент окончания фиксируется один раз — когда открылась модалка
  // (т.е. когда нажали «Завершить смену»). Время больше не идёт.
  const [endAt] = useState(() => new Date().toISOString());
  const frozenMs = activeMs(shift, new Date(endAt).getTime());

  function handleConfirm() {
    const earningsNum = Number(earnings.replace(',', '.'));
    if (!Number.isFinite(earningsNum) || earningsNum < 0) return;

    const tipsNum = tips.trim() === '' ? null : Number(tips.replace(',', '.'));
    const total = earningsNum + (tipsNum ?? 0);
    const hours = frozenMs / MS_PER_HOUR;
    const rate = hours > 0 ? total / hours : null;

    const deliveriesNum = deliveries.trim() === '' ? null : Number(deliveries);

    onConfirm(
      {
        earnings: earningsNum,
        tips: Number.isFinite(tipsNum as number) ? tipsNum : null,
        deliveries: Number.isFinite(deliveriesNum as number) ? deliveriesNum : null,
        note: note.trim() || null,
      },
      endAt
    );

    setResult({ durationMs: frozenMs, earnings: total, rate });
  }

  const valid = earnings.trim() !== '' && Number(earnings.replace(',', '.')) >= 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? t.endShift.savedTitle : t.endShift.title}
      dismissable={!result}
    >
      {result ? (
        <div className="text-center">
          <div className="text-5xl my-2">✅</div>
          <div className="text-sm text-slate-400">{t.endShift.ratePerShift}</div>
          <div className="text-5xl font-extrabold text-brand-400 tabular my-2">
            {formatRate(result.rate, lang)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-xl bg-ink-800 p-3">
              <div className="text-xs text-slate-400">{t.endShift.netTime}</div>
              <div className="text-lg font-semibold tabular">
                {formatDuration(result.durationMs)}
              </div>
            </div>
            <div className="rounded-xl bg-ink-800 p-3">
              <div className="text-xs text-slate-400">{t.endShift.earnings}</div>
              <div className="text-lg font-semibold tabular">{formatMoney(result.earnings)}</div>
            </div>
          </div>
          <Button full size="lg" className="mt-5" onClick={onClose}>
            {t.common.done}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-ink-800 p-3 text-center">
            <div className="text-xs text-slate-400">{t.endShift.netWorkTime}</div>
            <div className="text-3xl font-bold tabular text-slate-50">
              {formatDuration(frozenMs)}
            </div>
          </div>

          <label className="block">
            <span className="text-sm text-slate-300">{t.endShift.earningsLabel}</span>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={earnings}
              onChange={(e) => setEarnings(e.target.value)}
              placeholder={t.endShift.earningsPlaceholder}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-2xl font-semibold tabular outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">{t.endShift.tipsLabel}</span>
            <input
              type="number"
              inputMode="decimal"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              placeholder={t.endShift.tipsPlaceholder}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">{t.endShift.deliveriesLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              value={deliveries}
              onChange={(e) => setDeliveries(e.target.value)}
              placeholder={t.endShift.deliveriesPlaceholder}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">{t.endShift.noteLabel}</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.endShift.notePlaceholder}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
            />
          </label>

          <div className="flex gap-3 pt-1">
            <Button variant="subtle" size="lg" className="flex-1" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button
              variant="success"
              size="lg"
              className="flex-1"
              disabled={!valid}
              onClick={handleConfirm}
            >
              {t.common.save}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
