import { useMemo } from 'react';
import { useAppState } from '../state/AppState';
import type { EndShiftInput, Shift, Vehicle } from '../types';
import { newId } from '../lib/id';
import { isPaused } from '../lib/time';

/**
 * Управление активной сменой. Активная смена — это элемент списка со status='active'.
 * Поэтому она автоматически восстанавливается из storage при перезагрузке.
 */
export function useActiveShift() {
  const { shifts, setShifts } = useAppState();
  const active = useMemo(() => shifts.find((s) => s.status === 'active') ?? null, [shifts]);

  function startShift(vehicle: Vehicle | null = null) {
    if (active) return;
    const shift: Shift = {
      id: newId(),
      status: 'active',
      startedAt: new Date().toISOString(), // абсолютный timestamp начала
      endedAt: null,
      breaks: [],
      earnings: null,
      deliveries: null,
      vehicle,
      note: null,
    };
    setShifts((prev) => [...prev, shift]);
  }

  function togglePause() {
    if (!active) return;
    const nowIso = new Date().toISOString();
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== active.id) return s;
        if (isPaused(s)) {
          // закрываем текущую паузу
          const breaks = s.breaks.map((b, i) =>
            i === s.breaks.length - 1 && b.end == null ? { ...b, end: nowIso } : b
          );
          return { ...s, breaks };
        }
        // открываем новую паузу
        return { ...s, breaks: [...s.breaks, { start: nowIso, end: null }] };
      })
    );
  }

  function endShift(input: EndShiftInput, endedAt?: string) {
    if (!active) return;
    // endedAt фиксируется в момент нажатия «Завершить» (передаётся из модалки),
    // а не в момент сохранения формы — иначе время «доезжало» бы, пока вводят заработок.
    const endIso = endedAt ?? new Date().toISOString();
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== active.id) return s;
        const breaks = s.breaks.map((b) => (b.end == null ? { ...b, end: endIso } : b));
        return {
          ...s,
          status: 'completed',
          endedAt: endIso,
          breaks,
          earnings: input.earnings,
          deliveries: input.deliveries ?? null,
          vehicle: input.vehicle ?? s.vehicle,
          note: input.note ?? null,
        };
      })
    );
  }

  /** Отмена активной смены без сохранения в историю. */
  function cancelShift() {
    if (!active) return;
    setShifts((prev) => prev.filter((s) => s.id !== active.id));
  }

  return {
    active,
    paused: active ? isPaused(active) : false,
    startShift,
    togglePause,
    endShift,
    cancelShift,
  };
}
