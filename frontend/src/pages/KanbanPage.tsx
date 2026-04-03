import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useState, useMemo } from 'react';
import { subMonths } from 'date-fns';
import { useAuthStore } from '../store/auth.store.ts';
import { useProjets } from '../hooks/useProjets.ts';
import { useRessources } from '../hooks/useRessources.ts';
import { useTags } from '../hooks/useTags.ts';
import KanbanColonne from '../components/KanbanColonne.tsx';
import ProjetCard from '../components/ProjetCard.tsx';
import ProjetFormModal from '../components/ProjetFormModal.tsx';
import ProjetDetailPanel from '../components/ProjetDetailPanel.tsx';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import { STATUTS_PROJET } from '../lib/types.ts';
import type { StatutProjet, Projet } from '../lib/types.ts';
import { usePoles } from '../hooks/usePoles.ts';
import api from '../lib/api.ts';

export default function KanbanPage() {
  const { user } = useAuthStore();
  const { projets, loading, error, refresh, updateStatut } = useProjets();
  const { ressources } = useRessources();
  const { tags } = useTags('projet');
  const { poles } = usePoles();
  const [activeProjet, setActiveProjet] = useState<Projet | null>(null);

  const [projetForm, setProjetForm] = useState<{ open: boolean; projet?: Projet }>({ open: false });
  const [detailProjet, setDetailProjet] = useState<Projet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Projet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  // Filtres
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterReferentId, setFilterReferentId] = useState('');
  const [filterPoleId, setFilterPoleId] = useState('');
  const [filterTagId, setFilterTagId] = useState('');
  const [filterTermineDelai, setFilterTermineDelai] = useState(2); // mois

  const isResponsable = user?.role === 'responsable' || user?.role === 'direction_generale';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const hasActiveFilters = !!(filterReferentId || filterPoleId || filterTagId || filterTermineDelai !== 2);

  const projetsFiltered = useMemo(() => {
    const termineThreshold = subMonths(new Date(), filterTermineDelai);
    return projets.filter((p) => {
      if (filterReferentId && p.referent?.id !== filterReferentId) return false;
      if (filterPoleId && p.pole?.id !== filterPoleId) return false;
      if (filterTagId && !p.tags.some((t) => t.id === filterTagId)) return false;
      if (p.statut === 'termine' && new Date(p.updatedAt) < termineThreshold) return false;
      return true;
    });
  }, [projets, filterReferentId, filterPoleId, filterTagId, filterTermineDelai]);

  const getProjetsByStatut = (statut: StatutProjet) =>
    projetsFiltered
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
      setDeleteError(undefined);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) setDeleteError(msg);
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
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              filtersOpen || hasActiveFilters
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filtrer
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
          </button>
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

      {/* Barre de filtres */}
      {filtersOpen && (
        <div className="px-6 py-2.5 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-4">
          {/* Référent */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Référent :</span>
            <select
              value={filterReferentId}
              onChange={(e) => setFilterReferentId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400 min-w-[140px]"
            >
              <option value="">Tous</option>
              {ressources.map((r) => (
                <option key={r.id} value={r.id}>{r.nom}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-4 bg-gray-300" />

          {/* Pôle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Pôle :</span>
            <select
              value={filterPoleId}
              onChange={(e) => setFilterPoleId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400"
            >
              <option value="">Tous</option>
              {poles.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-4 bg-gray-300" />

          {/* Tag */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Tag :</span>
            <select
              value={filterTagId}
              onChange={(e) => setFilterTagId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400 min-w-[140px]"
            >
              <option value="">Tous</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-4 bg-gray-300" />

          {/* Délai terminés */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Terminés depuis :</span>
            <select
              value={filterTermineDelai}
              onChange={(e) => setFilterTermineDelai(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400"
            >
              <option value={1}>1 mois</option>
              <option value={2}>2 mois</option>
              <option value={3}>3 mois</option>
              <option value={6}>6 mois</option>
              <option value={12}>12 mois</option>
              <option value={999}>Tous</option>
            </select>
          </div>

          {hasActiveFilters && (
            <>
              <div className="w-px h-4 bg-gray-300" />
              <button
                onClick={() => { setFilterReferentId(''); setFilterPoleId(''); setFilterTagId(''); setFilterTermineDelai(2); }}
                className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
              >
                Réinitialiser
              </button>
            </>
          )}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-y-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 h-full">
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
        onClose={() => { setDeleteTarget(null); setDeleteError(undefined); }}
        onConfirm={handleDelete}
        title="Supprimer le projet"
        message={`Supprimer "${deleteTarget?.titre}" ? Toutes ses tâches seront également supprimées. Action irréversible.`}
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
