import { kmFromDraft, type KmDraft } from '../lib/distance';
import { formatKm } from '../lib/money';
import { useI18n } from '../i18n/I18nProvider';

const inputCls =
  'mt-1 w-full rounded-xl bg-ink-800 border border-white/10 px-4 py-3 tabular outline-none focus:border-brand-500';

/**
 * Необязательные поля км: «км по Wolt» и реальный пробег —
 * одним числом или по одометру (начало/конец → разница автоматически).
 */
export function KmFields({ draft, onChange }: { draft: KmDraft; onChange: (d: KmDraft) => void }) {
  const { t, lang } = useI18n();
  const set = (patch: Partial<KmDraft>) => onChange({ ...draft, ...patch });
  const res = kmFromDraft(draft);

  return (
    <fieldset className="rounded-xl border border-white/10 p-3 space-y-3">
      <legend className="px-1 text-sm text-slate-300">{t.km.section}</legend>

      <label className="block">
        <span className="text-sm text-slate-300">{t.km.woltKm}</span>
        <input
          type="number"
          inputMode="decimal"
          value={draft.wolt}
          onChange={(e) => set({ wolt: e.target.value })}
          placeholder={t.km.woltKmHint}
          className={inputCls}
        />
      </label>

      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-300">{t.km.actualKm}</span>
          <div className="flex rounded-lg bg-ink-800 p-0.5 text-xs">
            {(['number', 'odometer'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ mode: m })}
                className={[
                  'px-2.5 py-1.5 rounded-md',
                  draft.mode === m ? 'bg-brand-500 text-white' : 'text-slate-300',
                ].join(' ')}
              >
                {m === 'number' ? t.km.modeNumber : t.km.modeOdometer}
              </button>
            ))}
          </div>
        </div>

        {draft.mode === 'number' ? (
          <input
            type="number"
            inputMode="decimal"
            value={draft.actual}
            onChange={(e) => set({ actual: e.target.value })}
            className={inputCls}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-slate-500">{t.km.odoStart}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft.odoStart}
                  onChange={(e) => set({ odoStart: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">{t.km.odoEnd}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft.odoEnd}
                  onChange={(e) => set({ odoEnd: e.target.value })}
                  className={[inputCls, res.odometerError ? 'border-rose-500' : ''].join(' ')}
                />
              </label>
            </div>
            {res.odometerError ? (
              <div className="mt-1 text-sm text-rose-400">{t.km.odoError}</div>
            ) : (
              res.actualKm != null && (
                <div className="mt-1 text-sm text-brand-400 tabular">
                  {t.km.odoResult(formatKm(res.actualKm, lang))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </fieldset>
  );
}
