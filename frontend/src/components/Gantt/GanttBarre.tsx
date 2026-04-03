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
import type { Projet } from '../../lib/types.ts';
import GanttTooltip from './GanttTooltip.tsx';

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

const STATUT_LABELS: Record<string, string> = {
  a_planifier: 'À planifier',
  planifie: 'Planifié',
  en_cours: 'En cours',
};

export default function GanttBarre({ projet, timelineStart, dayWidth, draggable, onUpdate, onOpenDetail }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<'top' | 'bottom'>('top');
  const [barRect, setBarRect] = useState<DOMRect | null>(null);

  if (!projet.dateDebut || !projet.duree) return null;

  const dureeReelle = projet.taches.reduce((s, t) => s + (t.duree ?? 0), 0);
  const tempsConsomme = projet.taches.reduce(
    (s, t) => s + (t.activites ?? []).reduce((sa, a) => sa + a.duree, 0), 0
  );
  const dureeAffichee = dureeReelle > 0 ? dureeReelle : projet.duree;
  const gaugePct = dureeReelle > 0 ? Math.min(1, tempsConsomme / dureeReelle) : 0;
  const gaugeOver = dureeReelle > 0 && tempsConsomme > dureeReelle;

  const dateDebut = new Date(projet.dateDebut);
  const dateFin = addBusinessDays(dateDebut, dureeAffichee);
  const left = dateToOffset(dateDebut, timelineStart, dayWidth);
  const width = businessDaysWidth(dateDebut, dureeAffichee, dayWidth);

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
      while (isWeekend(newDate)) newDate = addDays(newDate, 1);
      onUpdate(projet.id, { dateDebut: newDate.toISOString() });
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
      const newDuree = Math.max(1, countBusinessDays(dateDebut, newEndDate));
      onUpdate(projet.id, { duree: newDuree });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const bgColor = STATUT_COLORS[projet.statut] ?? '#a3a3a3';
  const showTooltip = isHovered && !isDragging && !isResizing;

  return (
    <div
      ref={barRef}
      className={`absolute select-none ${isDragging || isResizing ? 'opacity-70 z-10' : 'z-[1]'} ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{ left: `${left}px`, width: `${width}px`, top: '4px' }}
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
        <p className="font-semibold text-white truncate">{projet.titre}</p>
        <span
          className="inline-block mt-1 px-1.5 py-px rounded-md text-[10px] font-medium"
          style={{ backgroundColor: `${bgColor}40`, color: bgColor }}
        >
          {STATUT_LABELS[projet.statut] ?? projet.statut}
        </span>

        <div className="mt-1.5 pt-1.5 border-t border-white/10 space-y-0.5 text-white/65">
          <div className="flex justify-between gap-4">
            <span>Début</span>
            <span className="text-white/90">{format(dateDebut, 'd MMM yyyy', { locale: fr })}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Fin est.</span>
            <span className="text-white/90">{format(dateFin, 'd MMM yyyy', { locale: fr })}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Durée</span>
            <span className="text-white/90">
              {dureeAffichee} j {dureeReelle > 0 ? 'réels' : 'estimés'}
            </span>
          </div>
          {tempsConsomme > 0 && (
            <div className="flex justify-between gap-4">
              <span>Consommé</span>
              <span className={gaugeOver ? 'text-red-400 font-medium' : 'text-white/90'}>
                {tempsConsomme.toFixed(1)} j{gaugeOver ? ' ⚠' : ''}
              </span>
            </div>
          )}
        </div>

        {tempsConsomme > 0 && (
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
      </GanttTooltip>

      {/* Barre principale */}
      <div
        className="h-6 rounded flex items-center px-2 text-xs font-medium text-white relative"
        style={{ backgroundColor: bgColor }}
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

      {/* Jauge en dessous de la barre */}
      {dureeReelle > 0 && (
        <div className="h-1.5 w-full mt-0.5 rounded overflow-hidden bg-black/20 border border-gray-300/50">
          {tempsConsomme > 0 && (
            <div
              className="h-full transition-all"
              style={{
                width: `${gaugePct * 100}%`,
                backgroundColor: gaugeOver ? '#ef4444' : '#ffffff',
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
