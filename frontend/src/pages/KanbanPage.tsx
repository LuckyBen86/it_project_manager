import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useState } from 'react';
import { useAuthStore } from '../store/auth.store.ts';
import { useProjets } from '../hooks/useProjets.ts';
import KanbanColonne from '../components/KanbanColonne.tsx';
import ProjetCard from '../components/ProjetCard.tsx';
import ProjetFormModal from '../components/ProjetFormModal.tsx';
import ProjetDetailPanel from '../components/ProjetDetailPanel.tsx';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import { STATUTS_PROJET } from '../lib/types.ts';
import type { StatutProjet, Projet } from '../lib/types.ts';
import api from '../lib/api.ts';

export default function KanbanPage() {
  const { user } = useAuthStore();
  const { projets, loading, error, refresh, updateStatut } = useProjets();
  const [activeProjet, setActiveProjet] = useState<Projet | null>(null);

  const [projetForm, setProjetForm] = useState<{ open: boolean; projet?: Projet }>({ open: false });
  const [detailProjet, setDetailProjet] = useState<Projet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Projet | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isResponsable = user?.role === 'responsable';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const getProjetsByStatut = (statut: StatutProjet) =>
    projets
      .filter((p) => p.statut === statut)
      .sort((a, b) => {
        if (!a.dateButoire) return 1;
        if (!b.dateButoire) return -1;
        return new Date(a.dateButoire).getTime() - new Date(b.dateButoire).getTime();
      });

  const handleDragStart = (event: { active: { id: string | number } }) => {
    const projet = projets.find((p) => p.id === event.active.id);
    setActiveProjet(projet ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveProjet(null);
    const { active, over } = event;
    if (!over || !isResponsable) return;

    const projetId = active.id as string;
    const overId = over.id as string;

    // Si on dépose sur une colonne (statut direct)
    if (STATUTS_PROJET.includes(overId as StatutProjet)) {
      const projet = projets.find((p) => p.id === projetId);
      if (projet && projet.statut !== overId) {
        void updateStatut(projetId, overId as StatutProjet);
      }
      return;
    }

    // Si on dépose sur une carte, on récupère le statut de cette carte
    const targetProjet = projets.find((p) => p.id === overId);
    if (targetProjet) {
      const sourceProjet = projets.find((p) => p.id === projetId);
      if (sourceProjet && sourceProjet.statut !== targetProjet.statut) {
        void updateStatut(projetId, targetProjet.statut);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/projets/${deleteTarget.id}`);
      refresh();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Sync detail panel when projets refresh
  const syncedDetailProjet = detailProjet
    ? (projets.find((p) => p.id === detailProjet.id) ?? null)
    : null;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-sm text-gray-500">Chargement...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Vue Kanban</h2>
        <div className="flex items-center gap-2">
          {!isResponsable && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Lecture seule</span>
          )}
          {isResponsable && (
            <button
              onClick={() => setProjetForm({ open: true })}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
            >
              + Nouveau projet
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max">
            {STATUTS_PROJET.map((statut) => (
              <KanbanColonne
                key={statut}
                statut={statut}
                projets={getProjetsByStatut(statut)}
                draggable={isResponsable}
                onEdit={isResponsable ? (p) => setProjetForm({ open: true, projet: p }) : undefined}
                onDelete={isResponsable ? (p) => setDeleteTarget(p) : undefined}
                onOpen={(p) => setDetailProjet(p)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeProjet && <ProjetCard projet={activeProjet} draggable={false} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      <ProjetFormModal
        open={projetForm.open}
        onClose={() => setProjetForm({ open: false })}
        onSaved={refresh}
        projet={projetForm.projet}
      />

      {syncedDetailProjet && (
        <ProjetDetailPanel
          open={!!detailProjet}
          onClose={() => setDetailProjet(null)}
          projet={syncedDetailProjet}
          isResponsable={isResponsable}
          onRefresh={refresh}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer le projet"
        message={`Supprimer "${deleteTarget?.titre}" ? Toutes ses tâches seront également supprimées. Action irréversible.`}
        loading={deleting}
      />
    </div>
  );
}
