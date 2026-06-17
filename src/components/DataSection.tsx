import { useRef, useState } from 'react';
import { useAppState } from '../state/AppState';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { buildCsv, buildJson, downloadFile, parseImport, todayStamp } from '../lib/dataPort';

export function DataSection() {
  const { shifts, planned, setShifts, setPlanned } = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const completedCount = shifts.filter((s) => s.status === 'completed').length;

  function exportJson() {
    downloadFile(
      `wolt-tracker-${todayStamp()}.json`,
      'application/json',
      buildJson(shifts, planned)
    );
  }

  function exportCsv() {
    downloadFile(`wolt-tracker-${todayStamp()}.csv`, 'text/csv;charset=utf-8', buildCsv(shifts));
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволить выбрать тот же файл повторно
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseImport(String(reader.result));
        const ok = confirm(
          `Импортировать ${parsed.shifts.length} смен и ${parsed.planned.length} планов? ` +
            'Текущие данные будут заменены.'
        );
        if (!ok) return;
        setShifts(() => parsed.shifts);
        setPlanned(() => parsed.planned);
        setMsg(`✅ Импортировано: ${parsed.shifts.length} смен.`);
      } catch (err) {
        setMsg(`⚠️ ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="space-y-2 pt-2">
      <h2 className="font-semibold">Данные и резервная копия</h2>
      <Card className="space-y-3">
        <p className="text-sm text-slate-400">
          Данные хранятся только в этом браузере. Делай бэкап и сверяй с выписками Wolt.
          Сейчас: {completedCount} смен.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="subtle" onClick={exportJson} disabled={shifts.length === 0}>
            ⬇ JSON (бэкап)
          </Button>
          <Button variant="subtle" onClick={exportCsv} disabled={completedCount === 0}>
            ⬇ CSV (таблица)
          </Button>
        </div>
        <Button variant="ghost" full onClick={() => fileRef.current?.click()}>
          ⬆ Импорт из JSON
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
