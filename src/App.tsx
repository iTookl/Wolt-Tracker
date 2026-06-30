import { useState } from 'react';
import { TabBar } from './components/layout/TabBar';
import type { Tab } from './components/layout/TabBar';
import { IosInstallHint } from './components/IosInstallHint';
import { WelcomeScreen } from './components/WelcomeScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { PlanScreen } from './screens/PlanScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';

const WELCOME_KEY = 'wolt-tracker:welcomeSeen';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [showWelcome, setShowWelcome] = useState(
    () => localStorage.getItem(WELCOME_KEY) !== '1'
  );

  if (showWelcome) {
    return (
      <WelcomeScreen
        onDone={() => {
          localStorage.setItem(WELCOME_KEY, '1');
          setShowWelcome(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-md px-4 pb-28 safe-top">
        {tab === 'home' && <HomeScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'plan' && <PlanScreen />}
        {tab === 'analytics' && <AnalyticsScreen />}
      </main>
      <IosInstallHint />
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
