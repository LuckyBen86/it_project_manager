import { useRef, useState } from 'react';
import {
  dateToOffset,
  offsetToDate,
  businessDaysWidth,
  countBusinessDays,
  isWeekend,
} from '../../lib/gantt.ts';
import { addDays } from 'date-fns';
import type { Tache } from '../../lib/types.ts';

interface Props {
  tache: Tache;
  taskStart: Date;
  timelineStart: Date;
  dayWidth: number;
  draggable: boolean;
  minStartDate?: Date;
  onUpdate: (tacheId: string, updates: { dateDebut?: string; duree?: number }) => void;
  onOpenDetail?: () => void;
}

const TACHE_COLORS: Record<string, string> = {
  a_faire: '#94a3b8',
  en_cours: '#fb923c',
  termine: '#4ade80',
};

export default function TacheBarre({
  tache,
  taskStart,
  timelineStart,
  dayWidth,
  draggable,
  minStartDate,
  onUpdate,
  onOpenDetail,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  if (!tache.duree) return null;

  const left = dateToOffset(taskStart, timelineStart, dayWidth);
  const width = businessDaysWidth(taskStart, tache.duree, dayWidth);
  const bgColor = TACHE_COLORS[tache.statut] ?? '#94a3b8';

  // Offset px minimum imposé par les dépendances
  const minLeft = minStartDate
    ? dateToOffset(minStartDate, timelineStart, dayWidth)
    : 0;

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (!draggable) return;
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startLeft = left;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const clampedLeft = Math.max(minLeft, startLeft + dx);
      if (barRef.current) barRef.current.style.left = `${clampedLeft}px`;
    };

    const onUp = (ev: MouseEvent) => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const dx = ev.clientX - startX;
      const clampedLeft = Math.max(minLeft, startLeft + dx);
      let newDate = offsetToDate(clampedLeft, timelineStart, dayWidth);
      while (isWeekend(newDate)) newDate = addDays(newDate, 1);
      if (minStartDate && newDate < minStartDate) newDate = minStartDate;
      onUpdate(tache.id, { dateDebut: newDate.toISOString() });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!draggable) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = width;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newWidth = Math.max(dayWidth, startWidth + dx);
      if (barRef.current) barRef.current.style.width = `${newWidth}px`;
    };

    const onUp = (ev: MouseEvent) => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const dx = ev.clientX - startX;
      const newRight = left + startWidth + dx;
      const newEndDate = offsetToDate(newRight, timelineStart, dayWidth);
      const newDuree = Math.max(1, countBusinessDays(taskStart, newEndDate));
      onUpdate(tache.id, { duree: newDuree });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={barRef}
      className={`absolute top-1.5 h-5 rounded flex items-center px-1.5 text-xs font-medium text-white select-none ${
        isDragging || isResizing ? 'opacity-70 z-10' : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{ left: `${left}px`, width: `${Math.max(width, 20)}px`, backgroundColor: bgColor, opacity: isDragging || isResizing ? 0.7 : 0.85 }}
      onMouseDown={handleDragMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${tache.titre} — ${tache.duree} j ouvrés`}
    >
      <span className="truncate flex-1">{tache.titre}</span>

      {onOpenDetail && isHovered && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpenDetail(); }}
          title="Voir la fiche"
          className="shrink-0 ml-1 p-0.5 rounded hover:bg-white/30"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
      )}

      {draggable && (
        <div
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-white/30 rounded-r"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
}
