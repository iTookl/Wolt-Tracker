import { useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import { activeMs, formatHm, ratePerHour, totalEarnings } from '../lib/time';
import { formatMoney, formatRate } from '../lib/money';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ShiftDetailModal } from '../components/ShiftDetailModal';
import type { Shift } from '../types';
import { newId } from '../lib/id';
import { format, isToday, isYesterday, type Locale } from 'date-fns';
import { useI18n } from '../i18n/I18nProvider';
import type { Translations } from '../i18n/dict';

function dayLabel(iso: string, t: Translations, locale: Locale): string {
  const d = new Date(iso);
  if (isToday(d)) return t.history.today;
  if (isYesterday(d)) return t.history.yesterday;
  return format(d, 'd MMMM', { locale });
}

function makeDraft(): Shift {
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 60 * 60000);
  return {
    id: newId(),
    status: 'completed',
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    breaks: [],
    earnings: null,
    tips: null,
    deliveries: null,
    note: null,
  };
}

export function HistoryScreen() {
  const { t, locale, lang } = useI18n();
  const { completed, updateShift, addShift, deleteShift } = useShifts();
  const [selected, setSelected] = useState<Shift | null>(null);
  const [draft, setDraft] = useState<Shift | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.history.title}</h1>
        <Button size="md" variant="subtle" onClick={() => setDraft(makeDraft())}>
          {t.history.addManual}
        </Button>
      </div>

      {completed.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-slate-400">{t.history.empty}</p>
          <p className="text-slate-500 text-sm mt-1">{t.history.emptyHint}</p>
        </div>
      ) : (
        completed.map((s) => {
          const ms = activeMs(s);
          const rate = ratePerHour(s);
          const hasBreaks = s.breaks.length > 0;
          return (
            <button key={s.id} onClick={() => setSelected(s)} className="w-full text-left">
              <Card className="flex items-center justify-between active:bg-ink-800 transition-colors">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {dayLabel(s.startedAt, t, locale)}
                    <span className="text-slate-400 font-normal">
                      {' · '}
                      {format(new Date(s.startedAt), 'HH:mm')}
                      {s.endedAt ? `–${format(new Date(s.endedAt), 'HH:mm')}` : ''}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 mt-0.5 tabular">
                    {formatHm(ms)} · {formatMoney(totalEarnings(s))}
                    {s.deliveries != null ? ` · ${t.history.deliveriesSuffix(s.deliveries)}` : ''}
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {hasBreaks && (
                      <span className="text-[11px] rounded-full bg-ink-800 text-slate-400 px-2 py-0.5">
                        ☕ {t.history.breaksBadge(s.breaks.length)}
                      </span>
                    )}
                    {s.tips == null && (
                      <span className="text-[11px] rounded-full bg-amber-500/10 text-amber-300 px-2 py-0.5">
                        {t.history.tipsAsk}
                      </span>
                    )}
                    {s.tips != null && s.tips > 0 && (
                      <span className="text-[11px] rounded-full bg-ink-800 text-slate-400 px-2 py-0.5">
                        💰 {t.history.tipLabel(formatMoney(s.tips))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <div className="text-lg font-bold text-brand-400 tabular">{formatRate(rate, lang)}</div>
                </div>
              </Card>
            </button>
          );
        })
      )}

      {selected && (
        <ShiftDetailModal
          open={!!selected}
          shift={selected}
          onClose={() => setSelected(null)}
          onSave={(patch) => updateShift(selected.id, patch)}
          onDelete={() => deleteShift(selected.id)}
        />
      )}

      {draft && (
        <ShiftDetailModal
          open={!!draft}
          shift={draft}
          isNew
          onClose={() => setDraft(null)}
          onSave={(patch) => addShift({ ...draft, ...patch })}
          onDelete={() => setDraft(null)}
        />
      )}
    </div>
  );
}
