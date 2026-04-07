import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { subMonths } from 'date-fns';
import { useAuthStore } from '../store/auth.store.ts';
import { useProjets } from '../hooks/useProjets.ts';
import { useRessources } from '../hooks/useRessources.ts';
import { useTags } from '../hooks/useTags.ts';
import { usePoles } from '../hooks/usePoles.ts';
import ProjetFormModal from '../components/ProjetFormModal.tsx';
import ProjetDetailPanel from '../components/ProjetDetailPanel.tsx';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import { STATUT_COLORS, STATUT_LABELS } from '../lib/types.ts';
import type { Projet } from '../lib/types.ts';
import api from '../lib/api.ts';

function DureeCell({ projet }: { projet: Projet }) {
  const dureeReelle = projet.taches.reduce((s, t) => s + (t.duree ?? 0), 0);
  const tempsConsomme = projet.taches.reduce(
    (s, t) => s + (t.activites ?? []).reduce((sa, a) => sa + a.duree, 0), 0,
  );
  const dureeAffichee = dureeReelle > 0 ? dureeReelle : (projet.duree ?? null);
  if (!dureeAffichee) return <span className="text-gray-300">—</span>;

  const gaugePct = dureeReelle > 0 ? Math.min(1, tempsConsomme / dureeReelle) : 0;
  const gaugeOver = dureeReelle > 0 && tempsConsomme > dureeReelle;

  return (
    <div className="min-w-[72px]">
      <div className="flex items-baseline gap-1">
        <span className="text-gray-700 font-medium">{dureeAffichee}j</span>
        {tempsConsomme > 0 && (
          <span className={`text-[10px] ${gaugeOver ? 'text-red-500' : 'text-gray-400'}`}>
            ({tempsConsomme.toFixed(1)}j{gaugeOver ? ' ⚠' : ''})
          </span>
        )}
      </div>
      {dureeReelle > 0 && (
        <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden w-full">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, gaugePct * 100)}%`,
              backgroundColor: gaugeOver ? '#ef4444' : '#10b981',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function ListePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { projets, loading, error, refresh } = useProjets();
  const { ressources } = useRessources();
  const { poles } = usePoles();

  const isResponsable = user?.role === 'responsable' || user?.role === 'direction_generale';
  const canEditProjet = (p: Projet) => isResponsable || p.referent?.id === user?.id;

  const [projetForm, setProjetForm] = useState<{ open: boolean; projet?: Projet }>({ open: false });
  const [detailProjet, setDetailProjet] = useState<Projet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Projet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterReferentId, setFilterReferentId] = useState('');
  const [filterPoleId, setFilterPoleId] = useState('');
  const [filterTagId, setFilterTagId] = useState('');
  const [showTermine, setShowTermine] = useState(false);
  const [filterTermineDelai, setFilterTermineDelai] = useState(2);
  const { tags } = useTags('projet', filterPoleId || undefined);

  const [sortCol, setSortCol] = useState<'titre' | 'statut' | 'dateDebut' | 'dateButoire' | 'duree' | 'taches'>('dateButoire');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const referentsFiltres = useMemo(() =>
    filterPoleId ? ressources.filter((r) => (r.poles ?? []).some((rp) => rp.pole.id === filterPoleId)) : ressources,
  [ressources, filterPoleId]);

  const hasActiveFilters = !!(filterReferentId || filterPoleId || filterTagId || filterTermineDelai !== 2 || showTermine);

  const projetsFiltered = useMemo(() => {
    const termineThreshold = subMonths(new Date(), filterTermineDelai);
    return projets.filter((p) => {
      if (!showTermine && p.statut === 'termine') return false;
      if (showTermine && p.statut === 'termine' && new Date(p.updatedAt) < termineThreshold) return false;
      if (filterReferentId && p.referent?.id !== filterReferentId) return false;
      if (filterPoleId && p.pole?.id !== filterPoleId) return false;
      if (filterTagId && !p.tags.some((t) => t.id === filterTagId)) return false;
      return true;
    });
  }, [projets, showTermine, filterTermineDelai, filterReferentId, filterPoleId, filterTagId]);

  const projetsSorted = useMemo(() => {
    return [...projetsFiltered].sort((a, b) => {
      let av: string | number | null = null;
      let bv: string | number | null = null;
      if (sortCol === 'titre') { av = a.titre; bv = b.titre; }
      else if (sortCol === 'statut') { av = a.statut; bv = b.statut; }
      else if (sortCol === 'dateDebut') { av = a.dateDebut ?? ''; bv = b.dateDebut ?? ''; }
      else if (sortCol === 'dateButoire') { av = a.dateButoire ?? ''; bv = b.dateButoire ?? ''; }
      else if (sortCol === 'duree') { av = a.duree ?? 0; bv = b.duree ?? 0; }
      else if (sortCol === 'taches') { av = a.taches.length; bv = b.taches.length; }
      if (av === null || av === '') return sortDir === 'asc' ? 1 : -1;
      if (bv === null || bv === '') return sortDir === 'asc' ? -1 : 1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [projetsFiltered, sortCol, sortDir]);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortCol }) => {
    if (sortCol !== col) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1 text-brand-500">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thClass = 'px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap select-none';
  const thSortClass = `${thClass} cursor-pointer hover:text-gray-700 transition-colors`;

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

  const syncedDetailProjet = detailProjet
    ? (projets.find((p) => p.id === detailProjet.id) ?? null)
    : null;

  if (loading) return <div className="flex items-center justify-center h-full text-sm text-gray-500">Chargement...</div>;
  if (error)   return <div className="flex items-center justify-center h-full text-sm text-red-500">{error}</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Projets</h2>
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                onClick={() => navigate('/')}
                className="px-3 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </button>
              <button className="px-3 py-1.5 bg-brand-50 text-brand-700 border-l border-gray-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {projetsSorted.length} projet{projetsSorted.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isResponsable && !projets.some((p) => p.referent?.id === user?.id) && (
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
        <div className="px-6 py-2.5 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Pôle :</span>
            <select
              value={filterPoleId}
              onChange={(e) => {
                const newPoleId = e.target.value;
                setFilterPoleId(newPoleId);
                setFilterTagId('');
                if (newPoleId && filterReferentId) {
                  const r = ressources.find((r) => r.id === filterReferentId);
                  if (!r?.poles?.some((rp) => rp.pole.id === newPoleId)) setFilterReferentId('');
                }
              }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400"
            >
              <option value="">Tous</option>
              {poles.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          <div className="w-px h-4 bg-gray-300" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Référent :</span>
            <select
              value={filterReferentId}
              onChange={(e) => setFilterReferentId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400 min-w-[140px]"
            >
              <option value="">Tous</option>
              {referentsFiltres.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          </div>
          <div className="w-px h-4 bg-gray-300" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Tag :</span>
            <select
              value={filterTagId}
              onChange={(e) => setFilterTagId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400 min-w-[140px]"
            >
              <option value="">Tous</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>
          <div className="w-px h-4 bg-gray-300" />
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTermine}
              onChange={(e) => setShowTermine(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs text-gray-500 font-medium">Afficher "Terminé"</span>
          </label>
          {showTermine && (
            <>
              <div className="w-px h-4 bg-gray-300" />
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
            </>
          )}
          {hasActiveFilters && (
            <>
              <div className="w-px h-4 bg-gray-300" />
              <button
                onClick={() => { setFilterReferentId(''); setFilterPoleId(''); setFilterTagId(''); setFilterTermineDelai(2); setShowTermine(false); }}
                className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
              >
                Réinitialiser
              </button>
            </>
          )}
        </div>
      )}

      {/* Tableau */}
      <div className="flex-1 overflow-auto">
        {projetsSorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Aucun projet à afficher
          </div>
        ) : (
          <table className="min-w-full text-sm border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className={thSortClass} onClick={() => toggleSort('titre')}>
                  Projet <SortIcon col="titre" />
                </th>
                <th className={thSortClass} onClick={() => toggleSort('statut')}>
                  Statut <SortIcon col="statut" />
                </th>
                <th className={thClass}>Pôle</th>
                <th className={thClass}>Référent</th>
                <th className={thSortClass} onClick={() => toggleSort('dateDebut')}>
                  Début <SortIcon col="dateDebut" />
                </th>
                <th className={thSortClass} onClick={() => toggleSort('dateButoire')}>
                  Butoire <SortIcon col="dateButoire" />
                </th>
                <th className={thSortClass} onClick={() => toggleSort('duree')}>
                  Durée <SortIcon col="duree" />
                </th>
                <th className={thSortClass} onClick={() => toggleSort('taches')}>
                  Tâches <SortIcon col="taches" />
                </th>
                <th className={thClass}>Avancement</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projetsSorted.map((projet) => {
                const terminees = projet.taches.filter((t) => t.statut === 'termine').length;
                const total = projet.taches.length;
                const isLate = projet.dateButoire && projet.statut !== 'termine' && new Date(projet.dateButoire) < new Date();

                return (
                  <tr key={projet.id} className="group hover:bg-gray-50/60 transition-colors">
                    {/* Titre */}
                    <td className="px-3 py-2.5 max-w-[260px]">
                      <button
                        onClick={() => setDetailProjet(projet)}
                        className="text-sm font-semibold text-gray-800 hover:text-brand-600 transition-colors text-left truncate block w-full"
                        title={projet.titre}
                      >
                        {projet.titre}
                      </button>
                      {projet.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {projet.tags.map((t) => (
                            <span key={t.id} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 leading-none">
                              {t.nom}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Statut */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[projet.statut]}`}>
                        {STATUT_LABELS[projet.statut]}
                      </span>
                    </td>

                    {/* Pôle */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {projet.pole ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 font-medium">
                          {projet.pole.nom}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Référent */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600">
                      {projet.referent?.nom ?? <span className="text-gray-300">—</span>}
                    </td>

                    {/* Date début */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600">
                      {projet.dateDebut
                        ? format(new Date(projet.dateDebut), 'd MMM yyyy', { locale: fr })
                        : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Date butoire */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                      {projet.dateButoire ? (
                        <span className={isLate ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {format(new Date(projet.dateButoire), 'd MMM yyyy', { locale: fr })}
                          {isLate && <span className="ml-1">⚠</span>}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Durée + jauge */}
                    <td className="px-3 py-2.5">
                      <DureeCell projet={projet} />
                    </td>

                    {/* Tâches */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {total === 0 ? (
                        <span className="text-gray-300 text-xs">—</span>
                      ) : (
                        <div className="min-w-[64px]">
                          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                            <span>{terminees}/{total}</span>
                            <span className="text-gray-400">{Math.round((terminees / total) * 100)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{ width: `${(terminees / total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Avancement */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {projet.avancementProjet !== undefined ? (
                        <div className="min-w-[72px]">
                          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                            <span className="font-medium text-gray-700">{projet.avancementProjet}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${projet.avancementProjet >= 100 ? 'bg-green-500' : 'bg-amber-400'}`}
                              style={{ width: `${projet.avancementProjet}%` }}
                            />
                          </div>
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEditProjet(projet) && (
                          <button
                            onClick={() => setProjetForm({ open: true, projet })}
                            className="text-[11px] px-2 py-1 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                          >
                            Modifier
                          </button>
                        )}
                        {isResponsable && (
                          <button
                            onClick={() => setDeleteTarget(projet)}
                            className="text-[11px] px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
