import { useState } from 'react';
import type { Shift, Vehicle } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { VehiclePicker } from './VehiclePicker';
import { activeMs, formatDuration, MS_PER_HOUR } from '../lib/time';
import { formatRate } from '../lib/money';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  shift: Shift;
  onClose: () => void;
  onSave: (patch: Partial<Shift>) => void;
  onDelete: () => void;
}

const toLocalInput = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
const fromLocalInput = (value: string) => new Date(value).toISOString();

export function ShiftDetailModal({ open, shift, onClose, onSave, onDelete }: Props) {
  const [startedAt, setStartedAt] = useState(toLocalInput(shift.startedAt));
  const [endedAt, setEndedAt] = useState(
    shift.endedAt ? toLocalInput(shift.endedAt) : ''
  );
  const [earnings, setEarnings] = useState(shift.earnings?.toString() ?? '');
  const [deliveries, setDeliveries] = useState(shift.deliveries?.toString() ?? '');
  const [vehicle, setVehicle] = useState<Vehicle | null>(shift.vehicle);
  const [note, setNote] = useState(shift.note ?? '');

  // Предпросмотр пересчёта на основе текущих правок.
  const preview: Shift = {
    ...shift,
    startedAt: fromLocalInput(startedAt),
    endedAt: endedAt ? fromLocalInput(endedAt) : shift.endedAt,
    earnings: earnings.trim() === '' ? null : Number(earnings.replace(',', '.')),
  };
  const previewMs = activeMs(preview);
  const previewRate =
    preview.earnings != null && previewMs > 0
      ? preview.earnings / (previewMs / MS_PER_HOUR)
      : null;

  function handleSave() {
    onSave({
      startedAt: fromLocalInput(startedAt),
      endedAt: endedAt ? fromLocalInput(endedAt) : shift.endedAt,
      earnings: earnings.trim() === '' ? null : Number(earnings.replace(',', '.')),
      deliveries: deliveries.trim() === '' ? null : Number(deliveries),
      vehicle,
      note: note.trim() || null,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Детали смены">
      <div className="space-y-4">
        <div className="rounded-xl bg-ink-800 p-3 flex justify-between items-center">
          <div>
            <div className="text-xs text-slate-400">Чистое время</div>
            <div className="text-lg font-semibold tabular">{formatDuration(previewMs)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">₪/час</div>
            <div className="text-lg font-bold text-brand-400 tabular">
              {formatRate(previewRate)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-300">Начало</span>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Конец</span>
            <input
              type="datetime-local"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-slate-300">Заработок, ₪</span>
          <input
            type="number"
            inputMode="decimal"
            value={earnings}
            onChange={(e) => setEarnings(e.target.value)}
            className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-lg font-semibold tabular outline-none focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Доставок</span>
          <input
            type="number"
            inputMode="numeric"
            value={deliveries}
            onChange={(e) => setDeliveries(e.target.value)}
            className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
          />
        </label>

        <div>
          <span className="text-sm text-slate-300">Транспорт</span>
          <VehiclePicker value={vehicle} onChange={setVehicle} className="mt-1" />
        </div>

        <label className="block">
          <span className="text-sm text-slate-300">Заметка</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
          />
        </label>

        <div className="flex gap-3 pt-1">
          <Button variant="subtle" size="lg" className="flex-1" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={handleSave}>
            Сохранить
          </Button>
        </div>

        <button
          onClick={() => {
            if (confirm('Удалить эту смену? Действие необратимо.')) {
              onDelete();
              onClose();
            }
          }}
          className="w-full text-center text-sm text-rose-400/80 hover:text-rose-400 py-2"
        >
          Удалить смену
        </button>
      </div>
    </Modal>
  );
}
