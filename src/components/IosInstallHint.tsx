import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';

const DISMISS_KEY = 'wolt-tracker:iosHintDismissed';

function isIos(): boolean {
  const ua = navigator.userAgent || '';
  const iPhone = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ выдаёт себя за Mac — ловим по тач-возможностям.
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPhone || iPadOS;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function IosInstallHint() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  }

  return (
    <div
      className="fixed inset-x-0 z-40 px-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
    >
      <div className="mx-auto max-w-md rounded-2xl bg-ink-800 border border-brand-500/30 shadow-xl px-4 py-3 flex items-center gap-3">
        <div className="text-2xl shrink-0">⬆️</div>
        <div className="text-sm leading-snug">
          {t.ios.installPre}
          <span className="font-semibold">{t.ios.installShare}</span>
          {t.ios.installMid}
          <span className="font-semibold">{t.ios.installAdd}</span>.
        </div>
        <button
          onClick={dismiss}
          aria-label={t.ios.close}
          className="shrink-0 text-slate-400 hover:text-slate-200 text-xl leading-none px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
