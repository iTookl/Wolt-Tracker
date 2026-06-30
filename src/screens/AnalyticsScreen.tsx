import { lazy, Suspense, useState } from 'react';
import { SummaryScreen } from './SummaryScreen';

// Слоты тянут recharts — грузим лениво, только при открытии под-вкладки.
const StatsScreen = lazy(() =>
  import('./StatsScreen').then((m) => ({ default: m.StatsScreen }))
);

type Sub = 'summary' | 'slots';

const tabs: { id: Sub; label: string }[] = [
  { id: 'summary', label: '📊 Сводка' },
  { id: 'slots', label: '📈 Слоты' },
];

export function AnalyticsScreen() {
  const [sub, setSub] = useState<Sub>('summary');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={[
              'min-h-[44px] rounded-xl text-sm font-medium transition-colors',
              t.id === sub
                ? 'bg-brand-500 text-white'
                : 'bg-ink-800 text-slate-300 hover:bg-ink-700',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'summary' ? (
        <SummaryScreen />
      ) : (
        <Suspense
          fallback={<div className="text-center text-slate-500 py-20">Загрузка…</div>}
        >
          <StatsScreen />
        </Suspense>
      )}
    </div>
  );
}
