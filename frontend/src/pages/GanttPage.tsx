import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { subDays, differenceInDays, addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore } from '../store/auth.store.ts';
import { useProjets } from '../hooks/useProjets.ts';
import { useRessources } from '../hooks/useRessources.ts';
import { useTags } from '../hooks/useTags.ts';
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
  sortTasksTopologically,
  type ZoomLevel,
} from '../lib/gantt.ts';
import type { StatutProjet, Projet, Tache } from '../lib/types.ts';
import { STATUT_LABELS, STATUT_COLORS } from '../lib/types.ts';
import { usePoles } from '../hooks/usePoles.ts';
import DateRangeFilter from '../components/DateRangeFilter.tsx';

const GANTT_STATUTS: StatutProjet[] = ['a_planifier', 'planifie', 'en_cours'];
const TOTAL_DAYS = 180;

const PROJET_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6',
  '#ec4899', '#84cc16',
];

function getInitials(nom: string): string {
  return nom.split(/\s+/).map((p) => p[0] ?? '').join('').toUpperCase().slice(0, 2);
}

export default function GanttPage() {
  const { user } = useAuthStore();
  const { projets, loading, error, refresh, updateGantt, updateTacheGantt } = useProjets();
  const { ressources } = useRessources();
  const { tags: tagsProjets } = useTags('projet');
  const { tags: tagsTaches } = useTags('tache');
  const { poles } = usePoles();
  const [zoom, setZoom] = useState<ZoomLevel>('semaine');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(208);

  // Filtres
  const [filterStatuts, setFilterStatuts] = useState<Set<StatutProjet>>(new Set(GANTT_STATUTS));
  const [filterReferentId, setFilterReferentId] = useState('');
  const [filterPoleId, setFilterPoleId] = useState('');
  const [filterTagId, setFilterTagId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [detailProjet, setDetailProjet] = useState<Projet | null>(null);
  const [editProjet, setEditProjet] = useState<Projet | null>(null);
  const [tacheModal, setTacheModal] = useState<{ projetId: string; tache: Tache; projetDateDebut?: string } | null>(null);

  const isResponsable = user?.role === 'responsable' || user?.role === 'direction_generale';

  // Correction automatique : ramène en base la dateDebut des tâches antérieures à leur projet
  const correctedTachesRef = useRef(new Set<string>());
  useEffect(() => {
    if (loading || !isResponsable) return;
    for (const projet of projets) {
      if (!projet.dateDebut) continue;
      const projetStart = new Date(projet.dateDebut);
      for (const tache of projet.taches) {
        if (!tache.dateDebut || correctedTachesRef.current.has(tache.id)) continue;
        if (new Date(tache.dateDebut) < projetStart) {
          correctedTachesRef.current.add(tache.id);
          updateTacheGantt(projet.id, tache.id, { dateDebut: projetStart.toISOString() });
        }
      }
    }
  }, [projets, loading, isResponsable, updateTacheGantt]);

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

  const projetsGantt = useMemo(() => projets.filter((p) => {
    if (!filterStatuts.has(p.statut)) return false;
    if (filterReferentId && p.referent?.id !== filterReferentId) return false;
    if (filterPoleId && p.pole?.id !== filterPoleId) return false;
    if (filterTagId) {
      const matchProjet = p.tags.some((t) => t.id === filterTagId);
      const matchTache = p.taches.some((t) => t.tags.some((tt) => tt.id === filterTagId));
      if (!matchProjet && !matchTache) return false;
    }
    if (filterDateFrom && p.dateDebut && new Date(p.dateDebut) < new Date(filterDateFrom)) return false;
    if (filterDateTo && p.dateDebut && new Date(p.dateDebut) > new Date(filterDateTo + 'T23:59:59')) return false;
    return true;
  }), [projets, filterStatuts, filterReferentId, filterPoleId, filterTagId, filterDateFrom, filterDateTo]);
  const todayOffset = dateToOffset(new Date(), timelineStart, dayWidth);

  const syncedDetailProjet = detailProjet
    ? (projets.find((p) => p.id === detailProjet.id) ?? null)
    : null;

  /** Décale le projet ET toutes ses tâches ayant une dateDebut explicite du même delta. */
  const handleProjetGanttUpdate = useCallback(async (
    projetId: string,
    updates: { dateDebut?: string; duree?: number },
  ) => {
    if (updates.dateDebut) {
      const projet = projets.find((p) => p.id === projetId);
      if (projet?.dateDebut) {
        const delta = differenceInDays(new Date(updates.dateDebut), new Date(projet.dateDebut));
        if (delta !== 0) {
          await Promise.all(
            projet.taches
              .filter((t) => !!t.dateDebut)
              .map((t) =>
                updateTacheGantt(projetId, t.id, {
                  dateDebut: addDays(new Date(t.dateDebut!), delta).toISOString(),
                }),
              ),
          );
        }
      }
    }
    await updateGantt(projetId, updates);
  }, [projets, updateGantt, updateTacheGantt]);

  /** Décale une tâche ET tous ses descendants transitifs (tâches dépendantes) du même delta. */
  const handleTacheGanttUpdate = useCallback(async (
    projetId: string,
    tacheId: string,
    updates: { dateDebut?: string; duree?: number },
  ) => {
    if (updates.dateDebut) {
      const projet = projets.find((p) => p.id === projetId);
      const tache = projet?.taches.find((t) => t.id === tacheId);
      if (projet && tache?.dateDebut) {
        const delta = differenceInDays(new Date(updates.dateDebut), new Date(tache.dateDebut));
        if (delta !== 0) {
          // Construire la map des successeurs : tacheId → [ids des tâches qui en dépendent]
          const successorMap = new Map<string, string[]>();
          for (const t of projet.taches) {
            for (const dep of t.dependances ?? []) {
              const list = successorMap.get(dep.precedentId) ?? [];
              list.push(t.id);
              successorMap.set(dep.precedentId, list);
            }
          }
          // BFS pour collecter tous les descendants transitifs
          const descendants = new Set<string>();
          const queue = [tacheId];
          while (queue.length > 0) {
            const current = queue.shift()!;
            for (const succId of successorMap.get(current) ?? []) {
              if (!descendants.has(succId)) {
                descendants.add(succId);
                queue.push(succId);
              }
            }
          }
          // Décaler les descendants ayant une dateDebut explicite
          await Promise.all(
            projet.taches
              .filter((t) => descendants.has(t.id) && !!t.dateDebut)
              .map((t) =>
                updateTacheGantt(projetId, t.id, {
                  dateDebut: addDays(new Date(t.dateDebut!), delta).toISOString(),
                }),
              ),
          );
        }
      }
    }
    await updateTacheGantt(projetId, tacheId, updates);
  }, [projets, updateTacheGantt]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    const handleMouseMove = (ev: MouseEvent) => {
      setPanelWidth(Math.max(120, Math.min(400, startWidth + ev.clientX - startX)));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

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
          <span className="text-xs text-gray-400">{projetsGantt.length} projet{projetsGantt.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              filtersOpen
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filtrer
          </button>
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

      {/* Barre de filtres */}
      {filtersOpen && <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-3">
        {/* Statuts */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium shrink-0">Statut :</span>
          <div className="flex gap-1">
            {GANTT_STATUTS.map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatuts((prev) => {
                  const next = new Set(prev);
                  if (next.has(s)) { if (next.size > 1) next.delete(s); } else next.add(s);
                  return next;
                })}
                className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                  filterStatuts.has(s)
                    ? STATUT_COLORS[s]
                    : 'bg-white text-gray-400 border-gray-200'
                }`}
              >
                {STATUT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-gray-300" />

        {/* Référent */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium shrink-0">Référent :</span>
          <select
            value={filterReferentId}
            onChange={(e) => setFilterReferentId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400"
          >
            <option value="">Tous</option>
            {ressources.map((r) => (
              <option key={r.id} value={r.id}>{r.nom}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-4 bg-gray-300" />

        {/* Pôle */}
        <div className="flex items-center gap-1.5">
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
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium shrink-0">Tag :</span>
          <select
            value={filterTagId}
            onChange={(e) => setFilterTagId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400"
          >
            <option value="">Tous</option>
            {tagsProjets.length > 0 && (
              <optgroup label="Projets">
                {tagsProjets.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </optgroup>
            )}
            {tagsTaches.length > 0 && (
              <optgroup label="Tâches">
                {tagsTaches.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </optgroup>
            )}
          </select>
        </div>

        <div className="w-px h-4 bg-gray-300" />

        <DateRangeFilter
          label="Période :"
          from={filterDateFrom}
          to={filterDateTo}
          onFromChange={setFilterDateFrom}
          onToChange={setFilterDateTo}
        />

        {/* Reset */}
        {(filterReferentId || filterPoleId || filterTagId || filterDateFrom || filterDateTo || filterStatuts.size < GANTT_STATUTS.length) && (
          <>
            <div className="w-px h-4 bg-gray-300" />
            <button
              onClick={() => {
                setFilterStatuts(new Set(GANTT_STATUTS));
                setFilterReferentId('');
                setFilterPoleId('');
                setFilterTagId('');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Réinitialiser
            </button>
          </>
        )}

      </div>}

      {/* Corps Gantt */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          {/* Labels projets (sticky gauche) */}
          <div className="shrink-0 border-r border-gray-200 bg-white z-10 sticky left-0 flex flex-col relative" style={{ width: `${panelWidth}px` }}>
            {/* Poignée de redimensionnement */}
            <div
              onMouseDown={handleResizeStart}
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-brand-400 transition-colors z-20 select-none"
            />
            {/* Ligne header vide (2 rangées : semaine + jours) */}
            <div className="h-12 border-b border-gray-200 bg-gray-50" />

            {projetsGantt.map((projet, projetIdx) => {
              const expanded = expandedIds.has(projet.id);
              const projetColor = PROJET_PALETTE[projetIdx % PROJET_PALETTE.length];
              return (
                <div key={projet.id}>
                  {/* Ligne projet */}
                  <div
                    className="h-8 px-2 flex items-center justify-between border-b border-gray-100 group transition-colors"
                    style={{ borderLeft: `3px solid ${projetColor}`, backgroundColor: `${projetColor}1a` }}
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
                      <button
                        onClick={() => isResponsable ? setEditProjet(projet) : setDetailProjet(projet)}
                        className="min-w-0 flex-1 text-xs font-semibold text-gray-800 truncate hover:text-brand-600 transition-colors text-left block"
                      >
                        {projet.titre}
                      </button>
                    </div>

                  </div>

                  {/* Lignes tâches (si déroulé) */}
                  {expanded && sortTasksTopologically(projet.taches).map((tache) => (
                    <div
                      key={tache.id}
                      className="h-8 px-2 flex items-center border-b border-gray-100 group hover:bg-gray-100/60 transition-colors"
                      style={{ borderLeft: `3px solid ${projetColor}55` }}
                    >
                      <div className="w-2 shrink-0" />
                      {/* Indicateur dépendance */}
                      {tache.dependances.length > 0 && (
                        <span
                          title={`Dépend de : ${tache.dependances.map((d) => d.precedent.titre).join(', ')}`}
                          className="shrink-0 mr-1 opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: projetColor }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </span>
                      )}
                      <p className="min-w-0 flex-1 text-xs text-gray-700 truncate">{tache.titre}</p>
                      {/* Initiales intervenants */}
                      {tache.ressources.length > 0 && (
                        <div className="flex -space-x-1 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {tache.ressources.slice(0, 3).map(({ ressource }) => (
                            <span
                              key={ressource.id}
                              title={ressource.nom}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-1 ring-white"
                              style={{ backgroundColor: projetColor }}
                            >
                              {getInitials(ressource.nom)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {expanded && projet.taches.length === 0 && (
                    <div
                      className="h-8 px-6 flex items-center border-b border-gray-100"
                      style={{ borderLeft: `3px solid ${projetColor}40` }}
                    >
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
            <div className="flex-1" />
          </div>

          {/* Grille temporelle */}
          <div className="flex-1">
            <div className="relative min-h-full" style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
              {/* En-têtes semaines/mois + jours */}
              <div className="border-b border-gray-200 bg-gray-50" style={{ width: `${totalWidth}px` }}>
                {/* Ligne 1 : semaines / mois */}
                <div className="h-6 relative border-b border-gray-200">
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
                {/* Ligne 2 : jours */}
                <div className="h-6 relative">
                  {dayColumns.map((col) =>
                    col.isWeekend ? (
                      <div
                        key={col.offsetPx}
                        className="absolute top-0 h-full bg-gray-100 border-r border-gray-200"
                        style={{ left: `${col.offsetPx}px`, width: `${col.widthPx}px` }}
                      />
                    ) : (
                      <div
                        key={col.offsetPx}
                        className="absolute top-0 h-full flex flex-col items-center justify-center border-r border-gray-100"
                        style={{ left: `${col.offsetPx}px`, width: `${col.widthPx}px` }}
                      >
                        {zoom === 'semaine' ? (
                          <>
                            <span className="text-[9px] leading-none font-medium text-gray-400 uppercase">
                              {format(col.date, 'EEEEE', { locale: fr })}
                            </span>
                            <span className="text-[10px] leading-none text-gray-600 mt-0.5">
                              {format(col.date, 'd')}
                            </span>
                          </>
                        ) : (
                          <span className="text-[9px] leading-none text-gray-500">
                            {format(col.date, 'd')}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Lignes projets + tâches */}
              {projetsGantt.map((projet, projetIdx) => {
                const expanded = expandedIds.has(projet.id);
                const projetDateDebut = projet.dateDebut ? new Date(projet.dateDebut) : null;
                const projetColor = PROJET_PALETTE[projetIdx % PROJET_PALETTE.length];

                return (
                  <div key={projet.id}>
                    {/* Ligne projet */}
                    <div
                      className="h-8 border-b border-gray-100 relative transition-colors"
                      style={{ width: `${totalWidth}px`, backgroundColor: `${projetColor}0d` }}
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
                          className="absolute top-0 h-full w-px bg-gray-300 z-10 pointer-events-none"
                          style={{ left: `${todayOffset}px` }}
                        />
                      )}

                      <GanttBarre
                        projet={projet}
                        timelineStart={timelineStart}
                        dayWidth={dayWidth}
                        draggable={isResponsable}
                        onUpdate={handleProjetGanttUpdate}
                      />

                      {/* Marqueur date butoire */}
                      {projet.dateButoire && (() => {
                        const offset = dateToOffset(new Date(projet.dateButoire), timelineStart, dayWidth);
                        if (offset < 0 || offset > totalWidth) return null;
                        return (
                          <div
                            className="absolute top-0 h-full pointer-events-none z-10"
                            style={{ left: `${offset}px` }}
                            title={`Date butoire : ${new Date(projet.dateButoire).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                          >
                            <div className="w-0.5 h-full bg-rose-500/60" />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Lignes tâches (si déroulé) */}
                    {expanded && (() => {
                      const projectStart = projetDateDebut ?? timelineStart;
                      const sortedTaches = sortTasksTopologically(projet.taches);
                      const taskStartDates = computeTaskStartDates(sortedTaches, projectStart);

                      return sortedTaches.map((tache) => {
                        // Date min = fin du prédécesseur le plus tardif
                        let minStartDate: Date | undefined;
                        for (const dep of tache.dependances ?? []) {
                          const pred = projet.taches.find((t) => t.id === dep.precedentId);
                          if (!pred?.duree) continue;
                          const predStart = taskStartDates.get(pred.id);
                          if (!predStart) continue;
                          const predEnd = addBusinessDays(predStart, pred.duree);
                          if (!minStartDate || predEnd > minStartDate) minStartDate = predEnd;
                        }
                        // La tâche ne peut pas commencer avant le début du projet
                        if (projetDateDebut && (!minStartDate || projetDateDebut > minStartDate)) {
                          minStartDate = projetDateDebut;
                        }

                        return (
                          <div
                            key={tache.id}
                            className="h-8 border-b border-gray-100 relative"
                            style={{ width: `${totalWidth}px`, backgroundColor: `${projetColor}07` }}
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
                                className="absolute top-0 h-full w-px bg-gray-300 z-10 pointer-events-none"
                                style={{ left: `${todayOffset}px` }}
                              />
                            )}

                            <TacheBarre
                              tache={tache}
                              taskStart={(() => {
                                const raw = taskStartDates.get(tache.id) ?? projectStart;
                                return projetDateDebut && raw < projetDateDebut ? projetDateDebut : raw;
                              })()}
                              timelineStart={timelineStart}
                              dayWidth={dayWidth}
                              draggable={isResponsable}
                              minStartDate={minStartDate}
                              onUpdate={(tacheId, updates) => handleTacheGanttUpdate(projet.id, tacheId, updates)}
                            />
                          </div>
                        );
                      });
                    })()}
                    {expanded && projet.taches.length === 0 && (
                      <div
                        className="h-8 border-b border-gray-100"
                        style={{ width: `${totalWidth}px`, backgroundColor: `${projetColor}07` }}
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
          projetDateDebut={tacheModal.projetDateDebut}
        />
      )}
    </div>
  );
}
