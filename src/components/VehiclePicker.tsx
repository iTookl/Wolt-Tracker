import type { Vehicle } from '../types';

const options: { id: Vehicle; label: string; icon: string }[] = [
  { id: 'bike', label: 'Вело', icon: '🚲' },
  { id: 'scooter', label: 'Скутер', icon: '🛵' },
  { id: 'car', label: 'Авто', icon: '🚗' },
];

interface Props {
  value: Vehicle | null;
  onChange: (v: Vehicle | null) => void;
  className?: string;
}

export function VehiclePicker({ value, onChange, className = '' }: Props) {
  return (
    <div className={['grid grid-cols-3 gap-2', className].join(' ')}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(on ? null : o.id)}
            className={[
              'flex flex-col items-center justify-center gap-1 rounded-xl py-3 min-h-[60px] border transition-colors',
              on
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-white/10 bg-ink-800 text-slate-300',
            ].join(' ')}
          >
            <span className="text-2xl leading-none">{o.icon}</span>
            <span className="text-xs font-medium">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const vehicleLabel: Record<Vehicle, string> = {
  bike: '🚲 Вело',
  scooter: '🛵 Скутер',
  car: '🚗 Авто',
};
