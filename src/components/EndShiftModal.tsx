import { useState } from 'react';
import type { EndShiftInput, Shift, Vehicle } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { activeMs, formatDuration, MS_PER_HOUR } from '../lib/time';
import { formatMoney, formatRate } from '../lib/money';
import { VehiclePicker } from './VehiclePicker';

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
  const [earnings, setEarnings] = useState('');
  const [tips, setTips] = useState('');
  const [deliveries, setDeliveries] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle | null>(shift.vehicle);
  const [note, setNote] = useState('');
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
        vehicle,
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
      title={result ? 'Смена сохранена' : 'Завершить смену'}
      dismissable={!result}
    >
      {result ? (
        <div className="text-center">
          <div className="text-5xl my-2">✅</div>
          <div className="text-sm text-slate-400">Заработок в час за эту смену</div>
          <div className="text-5xl font-extrabold text-brand-400 tabular my-2">
            {formatRate(result.rate)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-xl bg-ink-800 p-3">
              <div className="text-xs text-slate-400">Чистое время</div>
              <div className="text-lg font-semibold tabular">
                {formatDuration(result.durationMs)}
              </div>
            </div>
            <div className="rounded-xl bg-ink-800 p-3">
              <div className="text-xs text-slate-400">Заработок</div>
              <div className="text-lg font-semibold tabular">{formatMoney(result.earnings)}</div>
            </div>
          </div>
          <Button full size="lg" className="mt-5" onClick={onClose}>
            Готово
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-ink-800 p-3 text-center">
            <div className="text-xs text-slate-400">Чистое рабочее время</div>
            <div className="text-3xl font-bold tabular text-slate-50">
              {formatDuration(frozenMs)}
            </div>
          </div>

          <label className="block">
            <span className="text-sm text-slate-300">Заработок, ₪ *</span>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={earnings}
              onChange={(e) => setEarnings(e.target.value)}
              placeholder="например, 180"
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-2xl font-semibold tabular outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Чаевые, ₪ (можно добавить позже)</span>
            <input
              type="number"
              inputMode="decimal"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              placeholder="если уже видны в Wolt"
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Доставок (необязательно)</span>
            <input
              type="number"
              inputMode="numeric"
              value={deliveries}
              onChange={(e) => setDeliveries(e.target.value)}
              placeholder="например, 9"
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
            />
          </label>

          <div>
            <span className="text-sm text-slate-300">Транспорт</span>
            <VehiclePicker value={vehicle} onChange={setVehicle} className="mt-1" />
          </div>

          <label className="block">
            <span className="text-sm text-slate-300">Заметка (необязательно)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="дождь, центр, и т.п."
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
            />
          </label>

          <div className="flex gap-3 pt-1">
            <Button variant="subtle" size="lg" className="flex-1" onClick={onClose}>
              Отмена
            </Button>
            <Button
              variant="success"
              size="lg"
              className="flex-1"
              disabled={!valid}
              onClick={handleConfirm}
            >
              Сохранить
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
