import { useMemo } from 'react';
import { useAppState } from '../state/AppState';
import type { PlannedShift } from '../types';

/** Плановые смены + операции. Отсортированы по дате и времени начала. */
export function usePlannedShifts() {
  const { planned, setPlanned } = useAppState();

  const sorted = useMemo(
    () =>
      [...planned].sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.plannedStart.localeCompare(b.plannedStart);
      }),
    [planned]
  );

  function addPlanned(p: PlannedShift) {
    setPlanned((prev) => [...prev, p]);
  }

  function updatePlanned(id: string, patch: Partial<PlannedShift>) {
    setPlanned((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function deletePlanned(id: string) {
    setPlanned((prev) => prev.filter((p) => p.id !== id));
  }

  return { planned: sorted, addPlanned, updatePlanned, deletePlanned };
}
