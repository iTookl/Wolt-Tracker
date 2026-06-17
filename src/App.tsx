import { useState } from 'react';
import { TabBar } from './components/layout/TabBar';
import type { Tab } from './components/layout/TabBar';
import { HomeScreen } from './screens/HomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SummaryScreen } from './screens/SummaryScreen';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-md px-4 pb-28 safe-top">
        {tab === 'home' && <HomeScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'summary' && <SummaryScreen />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
