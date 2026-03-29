import { useState, useMemo } from 'react';
import { subDays } from 'date-fns';
import { useAuthStore } from '../store/auth.store.ts';
import { useProjets } from '../hooks/useProjets.ts';
import GanttBarre from '../components/Gantt/GanttBarre.tsx';
import TacheBarre from '../components/Gantt/TacheBarre.tsx';
import GanttArrows from '../components/Gantt/GanttArrows.tsx';
import ProjetDetailPanel from '../components/ProjetDetailPanel.tsx';
import ProjetFormModal from '../components/ProjetFormModal.tsx';
import TacheFormModal from '../components/TacheFormModal.tsx';
import {
  getDayWidth,
  getTimelineStart,
  buildTimelineHeaders,
  buildDayColumns,
  dateToOffset,
  computeTaskStartDates,
  addBusinessDays,
  type ZoomLevel,
} from '../lib/gantt.ts';
import type { StatutProjet, Projet, Tache } from '../lib/types.ts';
import { STATUT_LABELS } from '../lib/types.ts';

const GANTT_STATUTS: StatutProjet[] = ['a_planifier', 'planifie', 'en_cours'];
const TOTAL_DAYS = 180;

const TACHE_STATUT_LABELS: Record<string, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminée',
};

export default function GanttPage() {
  const { user } = useAuthStore();
  const { projets, loading, error, refresh, updateGantt, updateTacheGantt } = useProjets();
  const [zoom, setZoom] = useState<ZoomLevel>('semaine');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [detailProjet, setDetailProjet] = useState<Projet | null>(null);
  const [editProjet, setEditProjet] = useState<Projet | null>(null);
  const [tacheModal, setTacheModal] = useState<{ projetId: string; tache: Tache } | null>(null);

  const isResponsable = user?.role === 'responsable';
  const dayWidth = getDayWidth(zoom);
  const timelineStart = useMemo(() => getTimelineStart(zoom, subDays(new Date(), 7)), [zoom]);

  const dayColumns = useMemo(
    () => buildDayColumns(timelineStart, TOTAL_DAYS, dayWidth),
    [timelineStart, dayWidth],
  );

  const totalWidth = useMemo(
    () => dayColumns.reduce((sum, col) => sum + col.widthPx, 0),
    [dayColumns],
  );

  const headers = useMemo(
    () => buildTimelineHeaders(zoom, timelineStart, TOTAL_DAYS, dayWidth),
    [zoom, timelineStart, dayWidth],
  );

  const projetsGantt = projets.filter((p) => GANTT_STATUTS.includes(p.statut));
  const todayOffset = dateToOffset(new Date(), timelineStart, dayWidth);

  const syncedDetailProjet = detailProjet
    ? (projets.find((p) => p.id === detailProjet.id) ?? null)
    : null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center h-full text-sm text-gray-500">Chargement...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-sm text-red-500">{error}</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Vue Gantt</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Durées en jours ouvrés</span>
        </div>
        <div className="flex items-center gap-3">
          {!isResponsable && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Lecture seule</span>
          )}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['semaine', 'mois'] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-3 py-1.5 font-medium transition-colors capitalize ${
                  zoom === z ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Corps Gantt */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Labels projets (sticky gauche) */}
          <div className="w-52 shrink-0 border-r border-gray-200 bg-white z-10 sticky left-0">
            {/* Ligne header vide */}
            <div className="h-10 border-b border-gray-200 bg-gray-50" />

            {projetsGantt.map((projet) => {
              const expanded = expandedIds.has(projet.id);
              return (
                <div key={projet.id}>
                  {/* Ligne projet */}
                  <div
                    className="h-10 px-2 flex items-center justify-between border-b border-gray-100 group hover:bg-gray-50 transition-colors"
                    title={projet.titre}
                  >
                    {/* Chevron + infos */}
                    <div className="min-w-0 flex-1 flex items-center gap-1">
                      <button
                        onClick={() => toggleExpand(projet.id)}
                        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg
                          className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => setDetailProjet(projet)}
                          className="text-xs font-medium text-gray-800 truncate hover:text-brand-600 transition-colors text-left w-full block"
                        >
                          {projet.titre}
                        </button>
                        <p className="text-xs text-gray-400 leading-none mt-0.5">{STATUT_LABELS[projet.statut]}</p>
                      </div>
                    </div>

                    {/* Boutons au survol */}
                    <div className="flex gap-0.5 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setDetailProjet(projet)}
                        title="Voir les tâches"
                        className="p-1 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>
                      {isResponsable && (
                        <button
                          onClick={() => setEditProjet(projet)}
                          title="Modifier le projet"
                          className="p-1 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lignes tâches (si déroulé) */}
                  {expanded && projet.taches.map((tache) => (
                    <div
                      key={tache.id}
                      className="h-10 px-2 flex items-center border-b border-gray-100 bg-gray-50/50 group hover:bg-gray-100/60 transition-colors"
                    >
                      <div className="w-2 shrink-0" />
                      <div className="min-w-0 flex-1 pl-3">
                        <p className="text-xs text-gray-700 truncate">{tache.titre}</p>
                        <p className="text-xs text-gray-400 leading-none">{TACHE_STATUT_LABELS[tache.statut]}</p>
                      </div>
                      <button
                        onClick={() => setTacheModal({ projetId: projet.id, tache })}
                        title="Voir la fiche"
                        className="shrink-0 p-1 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {expanded && projet.taches.length === 0 && (
                    <div className="h-10 px-6 flex items-center border-b border-gray-100 bg-gray-50/50">
                      <span className="text-xs text-gray-400 italic">Aucune tâche</span>
                    </div>
                  )}
                </div>
              );
            })}

            {projetsGantt.length === 0 && (
              <div className="h-10 px-3 flex items-center">
                <span className="text-xs text-gray-400">Aucun projet à afficher</span>
              </div>
            )}
          </div>

          {/* Grille temporelle */}
          <div className="overflow-x-auto flex-1">
            <div className="relative" style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
              {/* En-têtes semaines/mois */}
              <div className="h-10 border-b border-gray-200 bg-gray-50 relative" style={{ width: `${totalWidth}px` }}>
                {headers.map((h) => (
                  <div
                    key={h.offsetPx}
                    className="absolute top-0 h-full flex items-center px-2 border-r border-gray-200 text-xs text-gray-500 font-medium overflow-hidden"
                    style={{ left: `${h.offsetPx}px`, width: `${h.widthPx}px` }}
                  >
                    {h.label}
                  </div>
                ))}
              </div>

              {/* Lignes projets + tâches */}
              {projetsGantt.map((projet) => {
                const expanded = expandedIds.has(projet.id);
                const projetDateDebut = projet.dateDebut ? new Date(projet.dateDebut) : null;

                return (
                  <div key={projet.id}>
                    {/* Ligne projet */}
                    <div
                      className="h-10 border-b border-gray-100 relative hover:bg-gray-50/50 transition-colors"
                      style={{ width: `${totalWidth}px` }}
                    >
                      {dayColumns.map((col) => (
                        <div
                          key={col.offsetPx}
                          className={`absolute top-0 h-full border-r ${
                            col.isWeekend ? 'bg-gray-100 border-gray-200' : 'border-gray-100'
                          }`}
                          style={{ left: `${col.offsetPx}px`, width: `${col.widthPx}px` }}
                        />
                      ))}

                      {todayOffset >= 0 && todayOffset <= totalWidth && (
                        <div
                          className="absolute top-0 h-full w-px bg-red-400 z-10 pointer-events-none"
                          style={{ left: `${todayOffset}px` }}
                        />
                      )}

                      <GanttBarre
                        projet={projet}
                        timelineStart={timelineStart}
                        dayWidth={dayWidth}
                        draggable={isResponsable}
                        onUpdate={updateGantt}
                        onOpenDetail={() => setDetailProjet(projet)}
                      />

                      {/* Marqueur date butoire */}
                      {projet.dateButoire && (() => {
                        const offset = dateToOffset(new Date(projet.dateButoire), timelineStart, dayWidth);
                        if (offset < 0 || offset > totalWidth) return null;
                        return (
                          <div
                            className="absolute top-0 h-full flex flex-col items-center pointer-events-none z-10"
                            style={{ left: `${offset}px` }}
                          >
                            <div className="w-px h-full bg-rose-500/40" />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-rose-500 border-2 border-white shadow pointer-events-auto cursor-default"
                              title={`Date butoire : ${new Date(projet.dateButoire).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                            />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Lignes tâches (si déroulé) */}
                    {expanded && (() => {
                      const taskStartDates = projetDateDebut
                        ? computeTaskStartDates(projet.taches, projetDateDebut)
                        : null;

                      return projet.taches.map((tache) => {
                        // Date min = fin du prédécesseur le plus tardif
                        let minStartDate: Date | undefined;
                        if (taskStartDates) {
                          for (const dep of tache.dependances ?? []) {
                            const pred = projet.taches.find((t) => t.id === dep.precedentId);
                            if (!pred?.duree) continue;
                            const predStart = taskStartDates.get(pred.id);
                            if (!predStart) continue;
                            const predEnd = addBusinessDays(predStart, pred.duree);
                            if (!minStartDate || predEnd > minStartDate) minStartDate = predEnd;
                          }
                        }

                        return (
                          <div
                            key={tache.id}
                            className="h-10 border-b border-gray-100 relative bg-gray-50/30"
                            style={{ width: `${totalWidth}px` }}
                          >
                            {dayColumns.map((col) => (
                              <div
                                key={col.offsetPx}
                                className={`absolute top-0 h-full border-r ${
                                  col.isWeekend ? 'bg-gray-100/60 border-gray-200' : 'border-gray-100'
                                }`}
                                style={{ left: `${col.offsetPx}px`, width: `${col.widthPx}px` }}
                              />
                            ))}

                            {todayOffset >= 0 && todayOffset <= totalWidth && (
                              <div
                                className="absolute top-0 h-full w-px bg-red-400/50 z-10 pointer-events-none"
                                style={{ left: `${todayOffset}px` }}
                              />
                            )}

                            {taskStartDates && (
                              <TacheBarre
                                tache={tache}
                                taskStart={taskStartDates.get(tache.id) ?? projetDateDebut!}
                                timelineStart={timelineStart}
                                dayWidth={dayWidth}
                                draggable={isResponsable}
                                minStartDate={minStartDate}
                                onUpdate={(tacheId, updates) => updateTacheGantt(projet.id, tacheId, updates)}
                                onOpenDetail={() => setTacheModal({ projetId: projet.id, tache })}
                              />
                            )}
                          </div>
                        );
                      });
                    })()}
                    {expanded && projet.taches.length === 0 && (
                      <div
                        className="h-10 border-b border-gray-100 bg-gray-50/30"
                        style={{ width: `${totalWidth}px` }}
                      />
                    )}
                  </div>
                );
              })}

              {projetsGantt.length === 0 && (
                <div className="h-10 flex items-center justify-center text-xs text-gray-400">
                  Aucun projet à planifier ou en cours
                </div>
              )}

              {/* Flèches de dépendances entre tâches */}
              <GanttArrows
                projetsGantt={projetsGantt}
                expandedIds={expandedIds}
                timelineStart={timelineStart}
                dayWidth={dayWidth}
                totalWidth={totalWidth}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Panneau détail projet + tâches */}
      {syncedDetailProjet && (
        <ProjetDetailPanel
          open={!!detailProjet}
          onClose={() => setDetailProjet(null)}
          projet={syncedDetailProjet}
          isResponsable={isResponsable}
          onRefresh={refresh}
        />
      )}

      {/* Formulaire édition projet */}
      <ProjetFormModal
        open={!!editProjet}
        onClose={() => setEditProjet(null)}
        onSaved={refresh}
        projet={editProjet ?? undefined}
      />

      {/* Fiche tâche */}
      {tacheModal && (
        <TacheFormModal
          open={!!tacheModal}
          onClose={() => setTacheModal(null)}
          onSaved={() => { refresh(); setTacheModal(null); }}
          projetId={tacheModal.projetId}
          tache={tacheModal.tache}
        />
      )}
    </div>
  );
}
