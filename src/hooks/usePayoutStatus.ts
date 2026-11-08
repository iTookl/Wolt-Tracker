import { useEffect, useState } from 'react';
import { useAppState } from '../state/AppState';
import { payoutStatus, type PayoutStatus } from '../lib/payoutDate';

/**
 * Статус даты следующей выплаты, который сам «замечает» смену дня:
 * пересчёт при возврате во вкладку/приложение (`visibilitychange`, `focus`)
 * и раз в минуту — чтобы переход через полночь по Израилю не требовал перезагрузки.
 */
export function usePayoutStatus(): PayoutStatus {
  const { payouts } = useAppState();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    const id = window.setInterval(sync, 60_000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  return payoutStatus(payouts.cutoffs, new Date(now));
}
