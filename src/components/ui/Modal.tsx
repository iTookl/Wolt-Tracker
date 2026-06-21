import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Запретить закрытие тапом по фону / свайпом (например, во время сохранения). */
  dismissable?: boolean;
}

export function Modal({ open, onClose, title, children, dismissable = true }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  // Сброс смещения при открытии
  useEffect(() => {
    if (open) setDragY(0);
  }, [open]);

  if (!open) return null;

  // --- Свайп вниз для закрытия (на мобильном) ---
  function onTouchStart(e: React.TouchEvent) {
    if (!dismissable) return;
    // Тянем только если контент прокручен в самый верх — иначе это обычный скролл.
    const scroller = scrollRef.current;
    if (scroller && scroller.scrollTop > 0) {
      dragStartY.current = null;
      return;
    }
    dragStartY.current = e.touches[0].clientY;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (dragStartY.current == null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  }
  function onTouchEnd() {
    if (dragStartY.current == null) return;
    if (dragY > 110) {
      onClose();
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismissable ? onClose : undefined}
      />
      <div
        ref={sheetRef}
        className="relative w-full sm:max-w-md bg-ink-900 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragStartY.current == null ? 'transform 0.2s ease' : undefined,
        }}
      >
        {/* «Ручка» — зона захвата для свайпа */}
        <div
          className="sm:hidden pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
        </div>
        <div ref={scrollRef} className="overflow-y-auto px-5 pb-5 pt-2 sm:pt-5 safe-bottom">
          {title && <h2 className="text-xl font-bold mb-4">{title}</h2>}
          {children}
        </div>
      </div>
    </div>
  );
}
