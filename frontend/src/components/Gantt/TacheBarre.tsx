import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { addDays } from 'date-fns';
import {
  dateToOffset,
  offsetToDate,
  businessDaysWidth,
  countBusinessDays,
  isWeekend,
  addBusinessDays,
} from '../../lib/gantt.ts';
import type { Tache } from '../../lib/types.ts';
import GanttTooltip from './GanttTooltip.tsx';

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

const TACHE_STATUT_LABELS: Record<string, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
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
  const [tooltipPos, setTooltipPos] = useState<'top' | 'bottom'>('top');
  const [barRect, setBarRect] = useState<DOMRect | null>(null);

  if (!tache.duree) return null;

  const left = dateToOffset(taskStart, timelineStart, dayWidth);
  const width = businessDaysWidth(taskStart, tache.duree, dayWidth);
  const bgColor = TACHE_COLORS[tache.statut] ?? '#94a3b8';
  const dateFin = addBusinessDays(taskStart, tache.duree);

  const dureeActivites = (tache.activites ?? []).reduce((s, a) => s + a.duree, 0);
  const gaugePct = tache.duree > 0 ? Math.min(1, dureeActivites / tache.duree) : 0;
  const gaugeOver = dureeActivites > tache.duree;

  const minLeft = minStartDate ? dateToOffset(minStartDate, timelineStart, dayWidth) : 0;

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

  const showTooltip = isHovered && !isDragging && !isResizing;

  return (
    <div
      ref={barRef}
      className={`absolute select-none ${isDragging || isResizing ? 'opacity-70 z-10' : 'z-[1]'} ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{ left: `${left}px`, width: `${Math.max(width, 20)}px`, top: '3px' }}
      onMouseDown={handleDragMouseDown}
      onMouseEnter={() => {
        if (barRef.current) {
          const rect = barRef.current.getBoundingClientRect();
          setBarRect(rect);
          setTooltipPos(rect.top > 220 ? 'top' : 'bottom');
        }
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip */}
      <GanttTooltip visible={showTooltip} anchorRect={barRect} position={tooltipPos}>
        <p className="font-semibold text-white truncate">{tache.titre}</p>
        <span
          className="inline-block mt-1 px-1.5 py-px rounded-md text-[10px] font-medium"
          style={{ backgroundColor: `${bgColor}40`, color: bgColor }}
        >
          {TACHE_STATUT_LABELS[tache.statut] ?? tache.statut}
        </span>

        <div className="mt-1.5 pt-1.5 border-t border-white/10 space-y-0.5 text-white/65">
          <div className="flex justify-between gap-4">
            <span>Début</span>
            <span className="text-white/90">{format(taskStart, 'd MMM yyyy', { locale: fr })}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Fin est.</span>
            <span className="text-white/90">{format(dateFin, 'd MMM yyyy', { locale: fr })}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Durée</span>
            <span className="text-white/90">{tache.duree} j alloués</span>
          </div>
          {dureeActivites > 0 && (
            <div className="flex justify-between gap-4">
              <span>Saisi</span>
              <span className={gaugeOver ? 'text-red-400 font-medium' : 'text-white/90'}>
                {dureeActivites.toFixed(1)} j{gaugeOver ? ' ⚠' : ''}
              </span>
            </div>
          )}
        </div>

        {dureeActivites > 0 && (
          <div className="mt-1.5 h-1 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, gaugePct * 100)}%`,
                backgroundColor: gaugeOver ? '#f87171' : '#34d399',
              }}
            />
          </div>
        )}

        {tache.ressources.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-white/10">
            <span className="text-white/50 text-[10px]">Intervenant{tache.ressources.length > 1 ? 's' : ''}</span>
            <p className="text-white/85">{tache.ressources.map((r) => r.ressource.nom).join(', ')}</p>
          </div>
        )}

        {tache.dependances.length > 0 && (
          <div className="mt-1 pt-1.5 border-t border-white/10">
            <span className="text-white/50 text-[10px]">Dépend de</span>
            <p className="text-white/85">{tache.dependances.map((d) => d.precedent.titre).join(', ')}</p>
          </div>
        )}
      </GanttTooltip>

      {/* Barre principale */}
      <div
        className="h-6 rounded flex items-center px-1.5 text-xs font-medium text-white relative"
        style={{ backgroundColor: bgColor, opacity: isDragging || isResizing ? 1 : 0.85 }}
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

      {/* Jauge en dessous de la barre */}
      <div className="h-1.5 w-full mt-0.5 rounded overflow-hidden bg-black/20 border border-gray-300/50">
        {dureeActivites > 0 && (
          <div
            className="h-full rounded transition-all"
            style={{
              width: `${gaugePct * 100}%`,
              backgroundColor: gaugeOver ? '#ef4444' : '#ffffff',
            }}
          />
        )}
      </div>
    </div>
  );
}
