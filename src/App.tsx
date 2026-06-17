import { lazy, Suspense, useState } from 'react';
import { TabBar } from './components/layout/TabBar';
import type { Tab } from './components/layout/TabBar';
import { HomeScreen } from './screens/HomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { PlanScreen } from './screens/PlanScreen';

// Экран статистики тянет recharts — грузим лениво, только при открытии.
const StatsScreen = lazy(() =>
  import('./screens/StatsScreen').then((m) => ({ default: m.StatsScreen }))
);

export default function App() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-md px-4 pb-28 safe-top">
        {tab === 'home' && <HomeScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'plan' && <PlanScreen />}
        {tab === 'summary' && <SummaryScreen />}
        {tab === 'stats' && (
          <Suspense
            fallback={<div className="text-center text-slate-500 py-20">Загрузка…</div>}
          >
            <StatsScreen />
          </Suspense>
        )}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
