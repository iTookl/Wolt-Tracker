import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Locale } from 'date-fns';
import { enUS, ru as ruLocale } from 'date-fns/locale';
import { dictionaries, type Translations } from './dict';

export type Lang = 'ru' | 'en';

const LANG_KEY = 'wolt-tracker:lang';

const dfLocales: Record<Lang, Locale> = { ru: ruLocale, en: enUS };

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
  locale: Locale;
}

const I18nContext = createContext<I18nValue | null>(null);

function readLang(): Lang {
  if (typeof localStorage === 'undefined') return 'ru';
  return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ru'; // дефолт — русский
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // приватный режим и т.п. — молча игнорируем
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: setLangState,
      t: dictionaries[lang],
      locale: dfLocales[lang],
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n должен использоваться внутри <I18nProvider>');
  return ctx;
}
