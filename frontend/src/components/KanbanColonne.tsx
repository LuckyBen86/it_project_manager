import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Projet, StatutProjet } from '../lib/types.ts';
import { STATUT_LABELS } from '../lib/types.ts';
import ProjetCard from './ProjetCard.tsx';

interface Props {
  statut: StatutProjet;
  projets: Projet[];
  draggable: boolean;
  onEdit?: (projet: Projet) => void;
  onDelete?: (projet: Projet) => void;
  onOpen?: (projet: Projet) => void;
}

const COLONNE_COLORS: Record<StatutProjet, string> = {
  non_valide: 'border-t-gray-400',
  a_planifier: 'border-t-yellow-400',
  planifie: 'border-t-blue-400',
  en_cours: 'border-t-orange-400',
  termine: 'border-t-green-400',
};

export default function KanbanColonne({ statut, projets, draggable, onEdit, onDelete, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: statut });

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 bg-gray-50 rounded-xl border-t-4 ${COLONNE_COLORS[statut]} transition-colors ${
        isOver ? 'bg-brand-50' : ''
      }`}
    >
      <div className="px-2.5 py-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{STATUT_LABELS[statut]}</span>
        <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
          {projets.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-[80px]">
        <SortableContext items={projets.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {projets.map((projet) => (
            <ProjetCard
              key={projet.id}
              projet={projet}
              draggable={draggable}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpen={onOpen}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
