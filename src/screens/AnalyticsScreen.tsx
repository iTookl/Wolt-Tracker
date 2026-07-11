import { lazy, Suspense, useState } from 'react';
import { SummaryScreen } from './SummaryScreen';
import { useI18n } from '../i18n/I18nProvider';

// Слоты тянут recharts — грузим лениво, только при открытии под-вкладки.
const StatsScreen = lazy(() =>
  import('./StatsScreen').then((m) => ({ default: m.StatsScreen }))
);

type Sub = 'summary' | 'slots';

export function AnalyticsScreen() {
  const { t } = useI18n();
  const [sub, setSub] = useState<Sub>('summary');
  const tabs: { id: Sub; label: string }[] = [
    { id: 'summary', label: t.analytics.summary },
    { id: 'slots', label: t.analytics.slots },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSub(tab.id)}
            className={[
              'min-h-[44px] rounded-xl text-sm font-medium transition-colors',
              tab.id === sub
                ? 'bg-brand-500 text-white'
                : 'bg-ink-800 text-slate-300 hover:bg-ink-700',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {sub === 'summary' ? (
        <SummaryScreen />
      ) : (
        <Suspense
          fallback={<div className="text-center text-slate-500 py-20">{t.common.loading}</div>}
        >
          <StatsScreen />
        </Suspense>
      )}
    </div>
  );
}
