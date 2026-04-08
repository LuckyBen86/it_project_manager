import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Projet } from '../lib/types.ts';
import { STATUT_COLORS, STATUT_LABELS } from '../lib/types.ts';

interface Props {
  projet: Projet;
  draggable: boolean;
  onEdit?: (projet: Projet) => void;
  onDelete?: (projet: Projet) => void;
  onOpen?: (projet: Projet) => void;
}

export default function ProjetCard({ projet, draggable, onEdit, onDelete, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: projet.id,
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const totalTaches = projet.taches.length;
  const terminees = projet.taches.filter((t) => t.statut === 'termine').length;

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      className={`bg-white border border-gray-200 rounded-lg p-2 shadow-sm select-none group ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <button
          className="text-xs font-semibold text-gray-900 text-left line-clamp-2 leading-snug hover:text-brand-600 transition-colors"
          onMouseDown={stopPropagation}
          onClick={(e) => { e.stopPropagation(); onOpen?.(projet); }}
        >
          {projet.titre}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {projet.pole && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium leading-none bg-brand-50 text-brand-700 border border-brand-200">
              {projet.pole.nom}
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${STATUT_COLORS[projet.statut]}`}>
            {STATUT_LABELS[projet.statut]}
          </span>
        </div>
      </div>

      {projet.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {projet.tags.map((t) => (
            <span key={t.id} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 leading-none">
              {t.nom}
            </span>
          ))}
        </div>
      )}

      {projet.dateButoire && (
        <p className="mt-1 text-[10px] leading-none text-gray-400">
          Butoire : {format(new Date(projet.dateButoire), 'dd MMM yyyy', { locale: fr })}
        </p>
      )}

      {totalTaches > 0 && (
        <div className="mt-1.5">
          <div className="flex justify-between text-[10px] leading-none text-gray-400 mb-1">
            <span>Tâches</span>
            <span>{terminees}/{totalTaches}</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full">
            <div
              className="h-1 bg-brand-500 rounded-full transition-all"
              style={{ width: `${(terminees / totalTaches) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions responsable */}
      {(onEdit || onDelete) && (
        <div
          className="mt-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={stopPropagation}
        >
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(projet); }}
              className="text-[10px] px-1.5 py-0.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
            >
              Modifier
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(projet); }}
              className="text-[10px] px-1.5 py-0.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
