import { useRef, useState } from 'react';
import { useAppState } from '../state/AppState';
import { useI18n } from '../i18n/I18nProvider';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { buildCsv, buildJson, downloadFile, parseImport, todayStamp } from '../lib/dataPort';

export function DataSection() {
  const { t } = useI18n();
  const { shifts, planned, goals, payouts, setShifts, setPlanned, setGoals, setPayouts } =
    useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const completedCount = shifts.filter((s) => s.status === 'completed').length;

  function exportJson() {
    downloadFile(
      `wolt-tracker-${todayStamp()}.json`,
      'application/json',
      buildJson(shifts, planned, goals, payouts)
    );
  }

  function exportCsv() {
    downloadFile(`wolt-tracker-${todayStamp()}.csv`, 'text/csv;charset=utf-8', buildCsv(shifts, t));
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволить выбрать тот же файл повторно
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseImport(String(reader.result), t);
        const ok = confirm(t.data.importConfirm(parsed.shifts.length, parsed.planned.length));
        if (!ok) return;
        setShifts(() => parsed.shifts);
        setPlanned(() => parsed.planned);
        setGoals(() => parsed.goals);
        setPayouts(() => parsed.payouts);
        setMsg(t.data.importDone(parsed.shifts.length));
      } catch (err) {
        setMsg(`⚠️ ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="space-y-2 pt-2">
      <h2 className="font-semibold">{t.data.title}</h2>
      <Card className="space-y-3">
        <p className="text-sm text-slate-400">{t.data.note(completedCount)}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="subtle" onClick={exportJson} disabled={shifts.length === 0}>
            {t.data.exportJson}
          </Button>
          <Button variant="subtle" onClick={exportCsv} disabled={completedCount === 0}>
            {t.data.exportCsv}
          </Button>
        </div>
        <Button variant="ghost" full onClick={() => fileRef.current?.click()}>
          {t.data.importJson}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onPickFile}
        />
        {msg && <p className="text-sm text-slate-300">{msg}</p>}
      </Card>
    </section>
  );
}
