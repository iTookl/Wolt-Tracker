import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SlotStat } from '../lib/stats';
import { LOW_DATA_THRESHOLD } from '../lib/stats';
import { useI18n } from '../i18n/I18nProvider';
import type { Translations } from '../i18n/dict';

interface Props {
  data: SlotStat[];
}

const BRAND = '#00a6e0';
const MUTED = '#475569'; // slate-600 — для слотов с малым числом смен

interface TooltipProps {
  active?: boolean;
  payload?: { payload: SlotStat }[];
  t?: Translations;
  lang?: 'ru' | 'en';
}

function ChartTooltip({ active, payload, t, lang }: TooltipProps) {
  if (!active || !payload?.length || !t) return null;
  const s = payload[0].payload;
  const unit = lang === 'en' ? '₪/h' : '₪/ч';
  return (
    <div className="rounded-lg bg-ink-800 border border-white/10 px-3 py-2 text-sm shadow-xl">
      <div className="font-semibold">
        {s.label}
        {s.hint ? <span className="text-slate-400 font-normal"> · {s.hint}</span> : ''}
      </div>
      <div className="tabular text-brand-400 font-bold">
        {s.rate == null ? t.stats.noData : `${Math.round(s.rate)} ${unit}`}
      </div>
      <div className="text-xs text-slate-400 tabular">
        {t.stats.shiftsCount(s.shiftCount)}
        {s.hours > 0 ? ` · ${s.hours.toFixed(1)} ${t.units.hour}` : ''}
      </div>
    </div>
  );
}

export function SlotBarChart({ data }: Props) {
  const { t, lang } = useI18n();
  const chartData = data.map((d) => ({ ...d, value: d.rate ?? 0 }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#1e293b' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          content={<ChartTooltip t={t} lang={lang} />}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {chartData.map((d) => (
            <Cell
              key={d.key}
              fill={d.shiftCount === 0 ? '#1e293b' : d.shiftCount < LOW_DATA_THRESHOLD ? MUTED : BRAND}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
