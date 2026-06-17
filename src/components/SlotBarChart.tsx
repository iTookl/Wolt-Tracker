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

interface Props {
  data: SlotStat[];
}

const BRAND = '#00a6e0';
const MUTED = '#475569'; // slate-600 — для слотов с малым числом смен

interface TooltipProps {
  active?: boolean;
  payload?: { payload: SlotStat }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="rounded-lg bg-ink-800 border border-white/10 px-3 py-2 text-sm shadow-xl">
      <div className="font-semibold">
        {s.label}
        {s.hint ? <span className="text-slate-400 font-normal"> · {s.hint}</span> : ''}
      </div>
      <div className="tabular text-brand-400 font-bold">
        {s.rate == null ? 'нет данных' : `${Math.round(s.rate)} ₪/ч`}
      </div>
      <div className="text-xs text-slate-400 tabular">
        {s.shiftCount} {s.shiftCount === 1 ? 'смена' : 'смен'}
        {s.hours > 0 ? ` · ${s.hours.toFixed(1)} ч` : ''}
      </div>
    </div>
  );
}

export function SlotBarChart({ data }: Props) {
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
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
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
