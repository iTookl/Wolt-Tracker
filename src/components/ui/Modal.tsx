import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Запретить закрытие тапом по фону (например, во время сохранения). */
  dismissable?: boolean;
}

export function Modal({ open, onClose, title, children, dismissable = true }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismissable ? onClose : undefined}
      />
      <div className="relative w-full sm:max-w-md bg-ink-900 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 safe-bottom max-h-[90vh] overflow-y-auto">
        <div className="mx-auto sm:hidden mb-3 h-1.5 w-12 rounded-full bg-white/15" />
        {title && <h2 className="text-xl font-bold mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
