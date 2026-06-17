import { useState } from 'react';
import type { Shift, Vehicle } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { VehiclePicker } from './VehiclePicker';
import {
  formatDuration,
  MS_PER_HOUR,
  segmentsActiveMs,
  segmentsToTimes,
  shiftToSegments,
  type WorkSegment,
} from '../lib/time';
import { formatRate } from '../lib/money';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  shift: Shift;
  isNew?: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Shift>) => void;
  onDelete: () => void;
}

// datetime-local <-> ISO. Устройство в TZ Asia/Jerusalem, поэтому local = израильское.
const toLocalInput = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
const fromLocalInput = (value: string) => new Date(value).toISOString();

interface SegInput {
  start: string; // datetime-local
  end: string;
}

const segOk = (s: SegInput) =>
  s.start !== '' && s.end !== '' && new Date(s.end).getTime() > new Date(s.start).getTime();

export function ShiftDetailModal({ open, shift, isNew = false, onClose, onSave, onDelete }: Props) {
  const [segments, setSegments] = useState<SegInput[]>(() =>
    shiftToSegments(shift).map((s) => ({ start: toLocalInput(s.start), end: toLocalInput(s.end) }))
  );
  const [earnings, setEarnings] = useState(shift.earnings?.toString() ?? '');
  const [tips, setTips] = useState(shift.tips?.toString() ?? '');
  const [deliveries, setDeliveries] = useState(shift.deliveries?.toString() ?? '');
  const [vehicle, setVehicle] = useState<Vehicle | null>(shift.vehicle);
  const [note, setNote] = useState(shift.note ?? '');

  const validSegs = segments.filter(segOk);
  const hasValid = validSegs.length > 0;

  // Предпросмотр пересчёта.
  const previewMs = segmentsActiveMs(
    validSegs.map((s) => ({ start: fromLocalInput(s.start), end: fromLocalInput(s.end) }))
  );
  const earningsNum = earnings.trim() === '' ? null : Number(earnings.replace(',', '.'));
  const tipsNum = tips.trim() === '' ? null : Number(tips.replace(',', '.'));
  const total =
    earningsNum == null && tipsNum == null ? null : (earningsNum ?? 0) + (tipsNum ?? 0);
  const previewRate = total != null && previewMs > 0 ? total / (previewMs / MS_PER_HOUR) : null;

  function updateSeg(i: number, patch: Partial<SegInput>) {
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function removeSeg(i: number) {
    setSegments((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addSeg() {
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      const base = last?.end ? new Date(last.end) : new Date();
      const start = new Date(base.getTime() + 60 * 60000); // +1ч от конца прошлого
      const end = new Date(start.getTime() + 60 * 60000);
      return [
        ...prev,
        { start: toLocalInput(start.toISOString()), end: toLocalInput(end.toISOString()) },
      ];
    });
  }

  function handleSave() {
    if (!hasValid) return;
    const times = segmentsToTimes(
      validSegs.map<WorkSegment>((s) => ({
        start: fromLocalInput(s.start),
        end: fromLocalInput(s.end),
      }))
    );
    onSave({
      startedAt: times.startedAt,
      endedAt: times.endedAt,
      breaks: times.breaks,
      earnings: earningsNum,
      tips: tipsNum,
      deliveries: deliveries.trim() === '' ? null : Number(deliveries),
      vehicle,
      note: note.trim() || null,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Новая смена' : 'Детали смены'}>
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

        {/* Периоды работы */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Периоды работы</span>
            {segments.length > 1 && (
              <span className="text-xs text-slate-500">перерывы считаются между ними</span>
            )}
          </div>

          {segments.map((seg, i) => {
            const bad = !segOk(seg);
            return (
              <div
                key={i}
                className={[
                  'rounded-xl border p-2.5 space-y-2',
                  bad ? 'border-rose-500/40 bg-rose-500/5' : 'border-white/10 bg-ink-800',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Период {i + 1}</span>
                  {segments.length > 1 && (
                    <button
                      onClick={() => removeSeg(i)}
                      className="text-xs text-rose-400/80 hover:text-rose-400 px-2 py-1"
                    >
                      Удалить
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] text-slate-500">Начало</span>
                    <input
                      type="datetime-local"
                      value={seg.start}
                      onChange={(e) => updateSeg(i, { start: e.target.value })}
                      className="mt-0.5 w-full rounded-lg bg-ink-900 border border-white/10 px-2 py-2 text-sm outline-none focus:border-brand-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-500">Конец</span>
                    <input
                      type="datetime-local"
                      value={seg.end}
                      onChange={(e) => updateSeg(i, { end: e.target.value })}
                      className="mt-0.5 w-full rounded-lg bg-ink-900 border border-white/10 px-2 py-2 text-sm outline-none focus:border-brand-500"
                    />
                  </label>
                </div>
              </div>
            );
          })}

          <button
            onClick={addSeg}
            className="w-full rounded-xl border border-dashed border-white/15 text-slate-300 hover:bg-ink-800 py-2.5 text-sm font-medium"
          >
            + Добавить период (после перерыва)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            <span className="text-sm text-slate-300">Чаевые, ₪</span>
            <input
              type="number"
              inputMode="decimal"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              placeholder="позже"
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-lg font-semibold tabular outline-none focus:border-brand-500"
            />
          </label>
        </div>

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
            {isNew ? 'Отмена' : 'Закрыть'}
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={!hasValid}
            onClick={handleSave}
          >
            {isNew ? 'Добавить' : 'Сохранить'}
          </Button>
        </div>

        {!isNew && (
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
        )}
      </div>
    </Modal>
  );
}
