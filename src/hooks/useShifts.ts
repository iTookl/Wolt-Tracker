import { useMemo } from 'react';
import { useAppState } from '../state/AppState';
import type { Shift } from '../types';

/** Завершённые смены + операции редактирования/удаления. */
export function useShifts() {
  const { shifts, setShifts } = useAppState();

  const completed = useMemo(
    () =>
      shifts
        .filter((s) => s.status === 'completed')
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [shifts]
  );

  function updateShift(id: string, patch: Partial<Shift>) {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addShift(shift: Shift) {
    setShifts((prev) => [...prev, shift]);
  }

  function deleteShift(id: string) {
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  return { completed, updateShift, addShift, deleteShift };
}
