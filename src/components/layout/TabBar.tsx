export type Tab = 'home' | 'history' | 'summary' | 'stats' | 'plan';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const items: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Смена', icon: '⏱' },
  { id: 'history', label: 'История', icon: '📋' },
  { id: 'plan', label: 'Планы', icon: '📅' },
  { id: 'summary', label: 'Сводка', icon: '📊' },
  { id: 'stats', label: 'Слоты', icon: '📈' },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-ink-900/95 backdrop-blur border-t border-white/10 safe-bottom">
      <div className="mx-auto max-w-md grid grid-cols-5">
        {items.map((it) => {
          const on = it.id === active;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={[
                'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px]',
                'transition-colors',
                on ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              <span className="text-xl leading-none">{it.icon}</span>
              <span className="text-[11px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
