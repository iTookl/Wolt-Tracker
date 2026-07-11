import { useState } from 'react';
import type { PlannedShift } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useI18n } from '../i18n/I18nProvider';

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
  const { t } = useI18n();
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
    <Modal open={open} onClose={onClose} title={isNew ? t.plannedModal.newTitle : t.plannedModal.title}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-300">{t.plannedModal.date}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 outline-none focus:border-brand-500"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-300">{t.plannedModal.start}</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-lg tabular outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">{t.plannedModal.end}</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-lg tabular outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-slate-300">{t.plannedModal.targetLabel}</span>
          <input
            type="number"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t.plannedModal.targetPlaceholder}
            className="mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 text-lg font-semibold tabular outline-none focus:border-brand-500"
          />
        </label>

        <div className="flex gap-3 pt-1">
          <Button variant="subtle" size="lg" className="flex-1" onClick={onClose}>
            {isNew ? t.common.cancel : t.common.close}
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={!valid}
            onClick={handleSave}
          >
            {isNew ? t.common.add : t.common.save}
          </Button>
        </div>

        {!isNew && (
          <button
            onClick={() => {
              if (confirm(t.plannedModal.deleteConfirm)) {
                onDelete();
                onClose();
              }
            }}
            className="w-full text-center text-sm text-rose-400/80 hover:text-rose-400 py-2"
          >
            {t.plannedModal.deletePlan}
          </button>
        )}
      </div>
    </Modal>
  );
}
