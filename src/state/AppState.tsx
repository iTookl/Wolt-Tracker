import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Goals, PayoutSettings, PlannedShift, Shift } from '../types';
import { storage } from '../lib/storage';

type Updater<T> = (prev: T[]) => T[];

interface AppStateValue {
  shifts: Shift[];
  planned: PlannedShift[];
  goals: Goals;
  payouts: PayoutSettings;
  setShifts: (updater: Updater<Shift>) => void;
  setPlanned: (updater: Updater<PlannedShift>) => void;
  setGoals: (updater: (prev: Goals) => Goals) => void;
  setPayouts: (updater: (prev: PayoutSettings) => PayoutSettings) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Загружаем один раз при старте — активная смена восстановится отсюда.
  const initial = useMemo(() => storage.load(), []);
  const [shifts, setShiftsState] = useState<Shift[]>(initial.shifts);
  const [planned, setPlannedState] = useState<PlannedShift[]>(initial.planned);
  const [goals, setGoalsState] = useState<Goals>(initial.goals);
  const [payouts, setPayoutsState] = useState<PayoutSettings>(initial.payouts);

  // Любое изменение немедленно персистим в репозиторий.
  useEffect(() => {
    storage.save({ shifts, planned, goals, payouts });
  }, [shifts, planned, goals, payouts]);

  const value = useMemo<AppStateValue>(
    () => ({
      shifts,
      planned,
      goals,
      payouts,
      setShifts: (updater) => setShiftsState(updater),
      setPlanned: (updater) => setPlannedState(updater),
      setGoals: (updater) => setGoalsState(updater),
      setPayouts: (updater) => setPayoutsState(updater),
    }),
    [shifts, planned, goals, payouts]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState должен использоваться внутри <AppStateProvider>');
  return ctx;
}
