import { useEffect, useState } from 'react';

/**
 * Тикающие «сейчас» в мс — ТОЛЬКО для перерисовки счётчика на экране.
 * Это НЕ источник истины по времени: длительность смены считается из
 * абсолютных timestamp'ов в lib/time.ts.
 *
 * - тикает, только когда нужно (active=true) — экономит батарею;
 * - при возврате из фона/разблокировке немедленно пересчитывает now,
 *   чтобы счётчик мгновенно «догнал» реальное время.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);

    const sync = () => setNow(Date.now());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [active, intervalMs]);

  return now;
}
