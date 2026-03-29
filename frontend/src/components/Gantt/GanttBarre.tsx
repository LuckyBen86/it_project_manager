import { useRef, useState } from 'react';
import {
  dateToOffset,
  offsetToDate,
  businessDaysWidth,
  countBusinessDays,
  isWeekend,
} from '../../lib/gantt.ts';
import { addDays } from 'date-fns';
import type { Projet } from '../../lib/types.ts';

interface Props {
  projet: Projet;
  timelineStart: Date;
  dayWidth: number;
  draggable: boolean;
  onUpdate: (id: string, updates: { dateDebut?: string; duree?: number }) => void;
  onOpenDetail?: () => void;
}

const STATUT_COLORS: Record<string, string> = {
  a_planifier: '#a3a3a3',
  planifie: '#3b82f6',
  en_cours: '#f97316',
};

export default function GanttBarre({ projet, timelineStart, dayWidth, draggable, onUpdate, onOpenDetail }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  if (!projet.dateDebut || !projet.duree) return null;

  const dateDebut = new Date(projet.dateDebut);
  const left = dateToOffset(dateDebut, timelineStart, dayWidth);
  // Largeur calculée en jours ouvrés (les week-ends intercalaires sont inclus visuellement
  // mais avec leur largeur réduite WEEKEND_WIDTH)
  const width = businessDaysWidth(dateDebut, projet.duree, dayWidth);

  // Drag horizontal — déplace la date de début (snap jour ouvré)
  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (!draggable) return;
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startLeft = left;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (barRef.current) barRef.current.style.left = `${startLeft + dx}px`;
    };

    const onUp = (ev: MouseEvent) => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const dx = ev.clientX - startX;
      let newDate = offsetToDate(startLeft + dx, timelineStart, dayWidth);
      // Garantir que la date de début est un jour ouvré
      while (isWeekend(newDate)) newDate = addDays(newDate, 1);
      onUpdate(projet.id, { dateDebut: newDate.toISOString() });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Resize bord droit — modifie la durée en jours ouvrés
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
      const newDuree = Math.max(1, countBusinessDays(dateDebut, newEndDate));
      onUpdate(projet.id, { duree: newDuree });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const bgColor = STATUT_COLORS[projet.statut] ?? '#a3a3a3';

  return (
    <div
      ref={barRef}
      className={`absolute top-1 h-7 rounded flex items-center px-2 text-xs font-medium text-white select-none ${
        isDragging || isResizing ? 'opacity-70 z-10' : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{ left: `${left}px`, width: `${width}px`, backgroundColor: bgColor }}
      onMouseDown={handleDragMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${projet.titre} — ${projet.duree} j ouvrés`}
    >
      <span className="truncate flex-1">{projet.titre}</span>

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
