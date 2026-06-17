import { useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { activeMs, formatHm, ratePerHour } from '../lib/time';
import { formatMoney, formatRate } from '../lib/money';
import { Card } from '../components/ui/Card';
import { ShiftDetailModal } from '../components/ShiftDetailModal';
import type { Shift } from '../types';
import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'Сегодня';
  if (isYesterday(d)) return 'Вчера';
  return format(d, 'd MMMM', { locale: ru });
}

export function HistoryScreen() {
  const { completed, updateShift, deleteShift } = useShifts();
  const [selected, setSelected] = useState<Shift | null>(null);

  if (completed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-5xl mb-3">📋</div>
        <p className="text-slate-400">Пока нет завершённых смен.</p>
        <p className="text-slate-500 text-sm mt-1">Начни первую на вкладке «Смена».</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold mb-2">История</h1>
      {completed.map((s) => {
        const ms = activeMs(s);
        const rate = ratePerHour(s);
        return (
          <button key={s.id} onClick={() => setSelected(s)} className="w-full text-left">
            <Card className="flex items-center justify-between active:bg-ink-800 transition-colors">
              <div>
                <div className="font-semibold">
                  {dayLabel(s.startedAt)}
                  <span className="text-slate-400 font-normal">
                    {' · '}
                    {format(new Date(s.startedAt), 'HH:mm')}
                    {s.endedAt ? `–${format(new Date(s.endedAt), 'HH:mm')}` : ''}
                  </span>
                </div>
                <div className="text-sm text-slate-400 mt-0.5 tabular">
                  {formatHm(ms)} · {formatMoney(s.earnings)}
                  {s.deliveries != null ? ` · ${s.deliveries} дост.` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-brand-400 tabular">
                  {formatRate(rate)}
                </div>
              </div>
            </Card>
          </button>
        );
      })}

      {selected && (
        <ShiftDetailModal
          open={!!selected}
          shift={selected}
          onClose={() => setSelected(null)}
          onSave={(patch) => updateShift(selected.id, patch)}
          onDelete={() => deleteShift(selected.id)}
        />
      )}
    </div>
  );
}
