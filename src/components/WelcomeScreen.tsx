import { Button } from './ui/Button';
import { LangToggle } from './layout/LangToggle';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  onDone: () => void;
}

const icons = ['⏱', '₪', '📅'];

export function WelcomeScreen({ onDone }: Props) {
  const { t } = useI18n();
  const points = t.welcome.points.map((p, i) => ({ ...p, icon: icons[i] }));
  return (
    <div className="fixed inset-0 z-[60] bg-ink-950 flex flex-col safe-top safe-bottom">
      <div className="px-6 pt-3 max-w-md mx-auto w-full flex justify-end">
        <LangToggle />
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-20 w-20 rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-4xl font-extrabold text-white shadow-lg shadow-brand-500/30">
            W
          </div>
          <h1 className="text-2xl font-bold">Wolt Tracker</h1>
          <p className="text-slate-400 mt-1">{t.welcome.subtitle}</p>
        </div>

        <div className="space-y-4">
          {points.map((p) => (
            <div key={p.title} className="flex gap-3 items-start">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-ink-800 flex items-center justify-center text-xl">
                {p.icon}
              </div>
              <div>
                <div className="font-semibold">{p.title}</div>
                <div className="text-sm text-slate-400 leading-snug">{p.text}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 text-center mt-8">{t.welcome.privacy}</p>
      </div>

      <div className="px-6 pb-4 max-w-md mx-auto w-full">
        <Button full size="xl" onClick={onDone}>
          {t.welcome.start}
        </Button>
      </div>
    </div>
  );
}
