import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface Props {
  visible: boolean;
  anchorRect: DOMRect | null;
  position: 'top' | 'bottom';
  children: ReactNode;
}

export default function GanttTooltip({ visible, anchorRect, position, children }: Props) {
  if (!visible || !anchorRect) return null;

  const isTop = position === 'top';

  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${anchorRect.left + anchorRect.width / 2}px`,
    transform: 'translateX(-50%)',
    zIndex: 9999,
    ...(isTop
      ? { bottom: `${window.innerHeight - anchorRect.top + 10}px` }
      : { top: `${anchorRect.bottom + 10}px` }),
  };

  return createPortal(
    <div style={style} className="pointer-events-none">
      {isTop ? (
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-900" />
      ) : (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-b-gray-900" />
      )}
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl ring-1 ring-white/10 px-3 py-2 text-[11px] leading-snug min-w-[190px] max-w-[270px]">
        {children}
      </div>
    </div>,
    document.body,
  );
}
