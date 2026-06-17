import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={['rounded-2xl bg-ink-900 border border-white/5 p-4', className].join(' ')}
    />
  );
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}

export function StatCard({ label, value, hint, accent = false }: StatProps) {
  return (
    <Card className={accent ? 'border-brand-500/30 bg-brand-500/5' : ''}>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div
        className={[
          'mt-1 text-2xl font-bold tabular',
          accent ? 'text-brand-400' : 'text-slate-50',
        ].join(' ')}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </Card>
  );
}
