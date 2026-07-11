import { useI18n, type Lang } from '../../i18n/I18nProvider';

const OPTIONS: { id: Lang; label: string }[] = [
  { id: 'ru', label: 'RU' },
  { id: 'en', label: 'EN' },
];

/** Компактный сегмент RU | EN для переключения языка. */
export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex rounded-full bg-ink-800 border border-white/10 p-0.5 text-xs font-semibold">
      {OPTIONS.map((o) => {
        const on = o.id === lang;
        return (
          <button
            key={o.id}
            onClick={() => setLang(o.id)}
            aria-pressed={on}
            className={[
              'px-2.5 py-1 rounded-full transition-colors',
              on ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
