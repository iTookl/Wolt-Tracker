import { useState } from 'react';
import type { PlannedShift } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface Props {
  open: boolean;
  planned: PlannedShift;
  isNew?: boolean;
  onClose: () => void;
  onSave: (patch: Partial<PlannedShift>) => void;
  onDelete: () => void;
}

export function PlannedShiftModal({
  open,
  planned,
  isNew = false,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [date, setDate] = useState(planned.date);
  const [start, setStart] = useState(planned.plannedStart);
  const [end, setEnd] = useState(planned.plannedEnd);
  const [target, setTarget] = useState(planned.targetEarnings?.toString() ?? '');

  const valid = date !== '' && start !== '' && end !== '';

  function handleSave() {
    if (!valid) return;
    onSave({
      date,
      plannedStart: start,
      plannedEnd: end,
      targetEarnings: target.trim() === '' ? null : Number(target.replace(',', '.')),
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Новый план' : 'План смены'}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-300">Дата</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-300">Начало</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-lg tabular outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Конец</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-lg tabular outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-slate-300">Цель по заработку, ₪ (необязательно)</span>
          <input
            type="number"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="например, 250"
            className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-lg font-semibold tabular outline-none focus:border-brand-500"
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
            disabled={!valid}
            onClick={handleSave}
          >
            {isNew ? 'Добавить' : 'Сохранить'}
          </Button>
        </div>

        {!isNew && (
          <button
            onClick={() => {
              if (confirm('Удалить этот план?')) {
                onDelete();
                onClose();
              }
            }}
            className="w-full text-center text-sm text-rose-400/80 hover:text-rose-400 py-2"
          >
            Удалить план
          </button>
        )}
      </div>
    </Modal>
  );
}
