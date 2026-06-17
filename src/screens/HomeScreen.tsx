import { useState } from 'react';
import { useActiveShift } from '../hooks/useActiveShift';
import { useNow } from '../hooks/useNow';
import {
  activeMs,
  currentBreakMs,
  formatDuration,
  formatHm,
} from '../lib/time';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { VehiclePicker } from '../components/VehiclePicker';
import { EndShiftModal } from '../components/EndShiftModal';
import { vehicleLabel } from '../components/VehiclePicker';
import type { Vehicle } from '../types';
import { format } from 'date-fns';

export function HomeScreen() {
  const { active, paused, startShift, togglePause, endShift, cancelShift } = useActiveShift();
  const [endOpen, setEndOpen] = useState(false);
  const [startVehicle, setStartVehicle] = useState<Vehicle | null>(null);

  // Тикаем, только когда есть активная смена и она не на паузе.
  const now = useNow(!!active && !paused);

  if (!active) {
    return (
      <div className="flex flex-col min-h-[70vh] justify-center gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Готов к смене?</h1>
          <p className="text-slate-400 mt-1">Нажми, чтобы засечь время точно.</p>
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-2 text-center">Транспорт (по желанию)</p>
          <VehiclePicker value={startVehicle} onChange={setStartVehicle} />
        </div>

        <Button
          size="xl"
          full
          onClick={() => startShift(startVehicle)}
          className="text-3xl"
        >
          ▶ Начать смену
        </Button>
      </div>
    );
  }

  const liveMs = activeMs(active, now);
  const breakMs = currentBreakMs(active, now);
  const breaksCount = active.breaks.length;

  return (
    <div className="flex flex-col min-h-[70vh] gap-6">
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 text-sm text-slate-400">
          <span
            className={[
              'inline-block h-2.5 w-2.5 rounded-full',
              paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse',
            ].join(' ')}
          />
          {paused ? 'На паузе' : 'Смена идёт'}
        </div>
        <div className="text-slate-400 text-sm mt-1">
          Начало: {format(new Date(active.startedAt), 'HH:mm')}
          {active.vehicle ? ` · ${vehicleLabel[active.vehicle]}` : ''}
        </div>
      </div>

      <div className="text-center my-2">
        <div className="text-xs uppercase tracking-widest text-slate-500">Чистое время</div>
        <div
          className={[
            'text-6xl sm:text-7xl font-extrabold tabular mt-1',
            paused ? 'text-amber-300' : 'text-slate-50',
          ].join(' ')}
        >
          {formatDuration(liveMs)}
        </div>
        {paused && (
          <div className="text-amber-400 mt-2 tabular">
            Пауза: {formatDuration(breakMs)}
          </div>
        )}
      </div>

      {breaksCount > 0 && (
        <Card className="text-center text-sm text-slate-400">
          Перерывов: {breaksCount} · в сумме {formatHm(
            active.breaks.reduce((sum, b) => {
              const s = new Date(b.start).getTime();
              const e = b.end ? new Date(b.end).getTime() : now;
              return sum + Math.max(0, e - s);
            }, 0)
          )}
        </Card>
      )}

      <div className="mt-auto space-y-3">
        <Button
          size="lg"
          full
          variant={paused ? 'success' : 'subtle'}
          onClick={togglePause}
        >
          {paused ? '▶ Продолжить' : '⏸ Пауза'}
        </Button>

        <Button size="xl" full variant="danger" onClick={() => setEndOpen(true)}>
          ⏹ Завершить смену
        </Button>

        <button
          onClick={() => {
            if (confirm('Отменить смену без сохранения в историю?')) cancelShift();
          }}
          className="w-full text-center text-sm text-slate-500 hover:text-slate-300 py-2"
        >
          Отменить смену
        </button>
      </div>

      {endOpen && (
        <EndShiftModal
          open={endOpen}
          shift={active}
          onClose={() => setEndOpen(false)}
          onConfirm={(input, endedAt) => endShift(input, endedAt)}
        />
      )}
    </div>
  );
}
