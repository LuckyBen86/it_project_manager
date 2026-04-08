import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useMesTaches } from '../hooks/useMesTaches.ts';
import { useMesDemandes } from '../hooks/useMesDemandes.ts';
import { useAuthStore } from '../store/auth.store.ts';
import type { StatutTache, TypeDemande } from '../lib/types.ts';
import { usePoles } from '../hooks/usePoles.ts';
import DateRangeFilter from '../components/DateRangeFilter.tsx';
import DateInput from '../components/DateInput.tsx';
import ActiviteHistoriqueModal from '../components/ActiviteHistoriqueModal.tsx';

const STATUT_LABELS: Record<StatutTache, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
};

const STATUT_COLORS: Record<StatutTache, string> = {
  a_faire: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-orange-100 text-orange-700',
  termine: 'bg-green-100 text-green-700',
};

const STATUTS: StatutTache[] = ['a_faire', 'en_cours', 'termine'];

interface QuickForm {
  description: string;
  date: string;
  duree: string;
}

interface DemandeForm {
  tacheId: string;
  type: TypeDemande;
  valeur: string;
}

export default function MesTachesPage() {
  const { taches, loading, error, addActivite, updateActivite, refresh } = useMesTaches();
  const { createDemande } = useMesDemandes();
  const { poles } = usePoles();
  const currentUser = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<StatutTache | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterProjetId, setFilterProjetId] = useState('');
  const [filterPoleId, setFilterPoleId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [openForms, setOpenForms] = useState<Record<string, boolean>>({});
  const [forms, setForms] = useState<Record<string, QuickForm>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [historiqueOpenId, setHistoriqueOpenId] = useState<string | null>(null);
  const historiqueOpen = historiqueOpenId ? taches.find((t) => t.id === historiqueOpenId) ?? null : null;
  const [demandeForm, setDemandeForm] = useState<DemandeForm | null>(null);
  const [submittingDemande, setSubmittingDemande] = useState(false);
  const [demandeError, setDemandeError] = useState('');

  const projetsDisponibles = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; titre: string }[] = [];
    for (const t of taches) {
      if (t.projet && !seen.has(t.projet.id)) {
        seen.add(t.projet.id);
        result.push({ id: t.projet.id, titre: t.projet.titre });
      }
    }
    return result.sort((a, b) => a.titre.localeCompare(b.titre));
  }, [taches]);

  const hasActiveFilters = !!(filterProjetId || filterPoleId || filterDateFrom || filterDateTo);

  const filtered = taches.filter((t) => {
    if (filter !== 'all' && t.statut !== filter) return false;
    if (filterProjetId && t.projet?.id !== filterProjetId) return false;
    if (filterPoleId && t.projet?.pole?.id !== filterPoleId) return false;
    if (filterDateFrom && (!t.dateDebut || new Date(t.dateDebut) < new Date(filterDateFrom))) return false;
    if (filterDateTo && (!t.dateDebut || new Date(t.dateDebut) > new Date(filterDateTo + 'T23:59:59'))) return false;
    return true;
  });

  const resetFilters = () => {
    setFilterProjetId('');
    setFilterPoleId('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  // Trier par date de début décroissante (sans date en dernier)
  const sorted = [...filtered].sort((a, b) => {
    if (!a.dateDebut && !b.dateDebut) return 0;
    if (!a.dateDebut) return 1;
    if (!b.dateDebut) return -1;
    return new Date(b.dateDebut).getTime() - new Date(a.dateDebut).getTime();
  });

  const toggleForm = (tacheId: string) => {
    setOpenForms((prev) => ({ ...prev, [tacheId]: !prev[tacheId] }));
    if (!forms[tacheId]) {
      setForms((prev) => ({
        ...prev,
        [tacheId]: { description: '', date: format(new Date(), 'yyyy-MM-dd'), duree: '' },
      }));
    }
    setFormErrors((prev) => ({ ...prev, [tacheId]: '' }));
  };

  const setField = (tacheId: string, field: keyof QuickForm, value: string) => {
    setForms((prev) => ({ ...prev, [tacheId]: { ...prev[tacheId], [field]: value } }));
  };

  const handleSubmitActivite = async (tacheId: string) => {
    const form = forms[tacheId];
    if (!form?.description.trim()) { setFormErrors((p) => ({ ...p, [tacheId]: 'Description requise' })); return; }
    const duree = parseFloat(form.duree);
    if (!form.duree || isNaN(duree) || duree <= 0) { setFormErrors((p) => ({ ...p, [tacheId]: 'Durée invalide' })); return; }
    setSubmitting((p) => ({ ...p, [tacheId]: true }));
    try {
      await addActivite(tacheId, { description: form.description.trim(), date: new Date(form.date).toISOString(), duree });
      setOpenForms((p) => ({ ...p, [tacheId]: false }));
      setForms((p) => ({ ...p, [tacheId]: { description: '', date: format(new Date(), 'yyyy-MM-dd'), duree: '' } }));
      setFormErrors((p) => ({ ...p, [tacheId]: '' }));
    } catch {
      setFormErrors((p) => ({ ...p, [tacheId]: 'Erreur lors de l\'enregistrement' }));
    } finally {
      setSubmitting((p) => ({ ...p, [tacheId]: false }));
    }
  };

  const handleSubmitDemande = async () => {
    if (!demandeForm) return;
    setDemandeError('');
    if (demandeForm.type !== 'terminer' && !demandeForm.valeur.trim()) {
      setDemandeError('Valeur requise'); return;
    }
    const tache = taches.find((t) => t.id === demandeForm.tacheId);
    if (tache && demandeForm.type === 'modifier_duree' && parseInt(demandeForm.valeur, 10) === tache.duree) {
      setDemandeError('La durée demandée est identique à la durée actuelle'); return;
    }
    if (tache && demandeForm.type === 'modifier_date_debut' && demandeForm.valeur === (tache.dateDebut?.slice(0, 10) ?? '')) {
      setDemandeError('La date demandée est identique à la date actuelle'); return;
    }
    setSubmittingDemande(true);
    try {
      await createDemande(demandeForm.tacheId, demandeForm.type, demandeForm.type !== 'terminer' ? demandeForm.valeur : undefined);
      setDemandeForm(null);
      await refresh();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDemandeError(msg ?? 'Erreur lors de la demande');
    } finally {
      setSubmittingDemande(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-sm text-gray-500">Chargement...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-sm text-red-500">{error}</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Mes tâches</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            {filtered.length !== taches.length ? `${filtered.length} / ${taches.length}` : taches.length} tâche{taches.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
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
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
            )}
          </button>
          {/* Filtre statut */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['all', ...STATUTS] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 font-medium transition-colors ${filter === s ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {s === 'all' ? 'Toutes' : STATUT_LABELS[s]}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Barre de filtres */}
      {filtersOpen && (
        <div className="px-6 py-2.5 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-4">
          {/* Projet */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Projet :</span>
            <select
              value={filterProjetId}
              onChange={(e) => setFilterProjetId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-400 min-w-[160px]"
            >
              <option value="">Tous</option>
              {projetsDisponibles.map((p) => (
                <option key={p.id} value={p.id}>{p.titre}</option>
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

          <DateRangeFilter
            label="Date début :"
            from={filterDateFrom}
            to={filterDateTo}
            onFromChange={setFilterDateFrom}
            onToChange={setFilterDateTo}
          />

          {hasActiveFilters && (
            <>
              <div className="w-px h-4 bg-gray-300" />
              <button
                onClick={resetFilters}
                className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
              >
                Réinitialiser
              </button>
            </>
          )}
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">Aucune tâche assignée</p>
          </div>
        )}

        {sorted.map((tache) => {
                const dureeActivites = (tache.activites ?? []).reduce((s, a) => s + a.duree, 0);
                const gaugePct = tache.duree ? Math.min(1, dureeActivites / tache.duree) : 0;
                const gaugeOver = !!tache.duree && dureeActivites > tache.duree;
                const isOpen = !!openForms[tache.id];
                const form = forms[tache.id] ?? { description: '', date: format(new Date(), 'yyyy-MM-dd'), duree: '' };

                return (
                  <div key={tache.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden ${gaugeOver ? 'border-red-400 border-l-4' : 'border-gray-200'}`}>
                    {/* Ligne principale */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Statut (lecture seule) */}
                      <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${STATUT_COLORS[tache.statut]}`}>
                        {STATUT_LABELS[tache.statut]}
                      </span>

                      {/* Titre + projet + dates */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{tache.titre}</p>
                          {tache.projet && (
                            <span className="text-xs text-gray-400 shrink-0">{tache.projet.titre}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {tache.dateDebut && (
                            <span className="text-xs text-gray-400">
                              Début : <span className="text-gray-600">{format(new Date(tache.dateDebut), 'dd/MM/yyyy')}</span>
                            </span>
                          )}
                          {tache.dateButoire && (
                            <span className="text-xs text-gray-400">
                              Butoir : <span className={`font-medium ${new Date(tache.dateButoire) < new Date() && tache.statut !== 'termine' ? 'text-red-600' : 'text-gray-600'}`}>{format(new Date(tache.dateButoire), 'dd/MM/yyyy')}</span>
                            </span>
                          )}
                          {tache.duree && (
                            <span className="text-xs text-gray-400">
                              Durée : <span className="text-gray-600">{tache.duree} j</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Durée + temps consommé */}
                      <div className="shrink-0 text-right">
                        {tache.duree ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              {gaugeOver && (
                                <span title="Dépassement du temps prévu" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-600 shrink-0">
                                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                              <span className={`font-semibold ${gaugeOver ? 'text-red-600' : 'text-gray-700'}`}>{dureeActivites.toFixed(2)} j</span>
                              {' / '}{tache.duree} j
                            </span>
                            {/* Jauge */}
                            <div className="w-24 h-1.5 rounded bg-gray-200 overflow-hidden">
                              <div
                                className="h-full rounded transition-all"
                                style={{ width: `${gaugePct * 100}%`, backgroundColor: gaugeOver ? '#ef4444' : '#22c55e' }}
                              />
                            </div>
                          </div>
                        ) : (
                          dureeActivites > 0 && (
                            <span className="text-xs text-gray-500">{dureeActivites.toFixed(2)} j consommés</span>
                          )
                        )}
                      </div>

                      {/* Boutons activités + demandes */}
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {/* Badge en attente de validation */}
                        {tache.enAttenteValidation && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                            En attente de validation
                          </span>
                        )}
                        <div className="flex gap-1.5">
                        <button
                          onClick={() => setHistoriqueOpenId(tache.id)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          Historique
                        </button>
                        {tache.statut !== 'termine' && (
                          <>
                          <button
                            onClick={() => { setDemandeForm({ tacheId: tache.id, type: 'terminer', valeur: '' }); setDemandeError(''); }}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                          >
                            Clôturer
                          </button>
                          <button
                            onClick={() => { setDemandeForm({ tacheId: tache.id, type: 'modifier_duree', valeur: String(tache.duree ?? '') }); setDemandeError(''); }}
                            className="text-xs px-2 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                            title="Demander une modification de durée"
                          >
                            Durée
                          </button>
                          <button
                            onClick={() => { setDemandeForm({ tacheId: tache.id, type: 'modifier_date_debut', valeur: tache.dateDebut ? tache.dateDebut.slice(0, 10) : '' }); setDemandeError(''); }}
                            className="text-xs px-2 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                            title="Demander une modification de date de début"
                          >
                            Date
                          </button>
                          <button
                            onClick={() => toggleForm(tache.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              isOpen
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-brand-600 text-white hover:bg-brand-700'
                            }`}
                          >
                            {isOpen ? 'Annuler' : '+ Activité'}
                          </button>
                          </>
                        )}
                        </div>
                      </div>
                    </div>

                    {/* Formulaire rapide */}
                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex items-end gap-3">
                          <div className="flex-1 min-w-0">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <input
                              type="text"
                              value={form.description}
                              onChange={(e) => setField(tache.id, 'description', e.target.value)}
                              placeholder="Ex : développement, réunion..."
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                              autoFocus
                            />
                          </div>
                          <div className="shrink-0 w-44">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                            <DateInput
                              value={form.date}
                              onChange={(v) => setField(tache.id, 'date', v)}
                              inputClassName="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                            />
                          </div>
                          <div className="shrink-0 w-28">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Durée (jours)</label>
                            <input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={form.duree}
                              onChange={(e) => setField(tache.id, 'duree', e.target.value)}
                              placeholder="ex: 0.5"
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                            />
                          </div>
                          <button
                            onClick={() => handleSubmitActivite(tache.id)}
                            disabled={submitting[tache.id]}
                            className="shrink-0 px-4 py-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors"
                          >
                            {submitting[tache.id] ? '...' : 'Enregistrer'}
                          </button>
                        </div>
                        {formErrors[tache.id] && (
                          <p className="text-xs text-red-500 mt-1.5">{formErrors[tache.id]}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
        })}
      </div>

      {/* Modal historique */}
      {historiqueOpen && currentUser && (
        <ActiviteHistoriqueModal
          tache={historiqueOpen}
          currentUserId={currentUser.id}
          onClose={() => setHistoriqueOpenId(null)}
          onUpdate={(activiteId, data) => updateActivite(historiqueOpen.id, activiteId, data)}
        />
      )}

      {/* Modal demande de validation */}
      {demandeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {demandeForm.type === 'terminer' && 'Demander la clôture de la tâche'}
              {demandeForm.type === 'modifier_duree' && 'Demander une modification de durée'}
              {demandeForm.type === 'modifier_date_debut' && 'Demander une modification de date de début'}
            </h3>

            {demandeForm.type === 'modifier_duree' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nouvelle durée (jours)</label>
                <input
                  type="number"
                  min={1}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                  value={demandeForm.valeur}
                  onChange={(e) => setDemandeForm((p) => p ? { ...p, valeur: e.target.value } : null)}
                  autoFocus
                />
              </div>
            )}

            {demandeForm.type === 'modifier_date_debut' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nouvelle date de début</label>
                <DateInput
                  value={demandeForm.valeur}
                  onChange={(v) => setDemandeForm((p) => p ? { ...p, valeur: v } : null)}
                />
              </div>
            )}

            {demandeForm.type === 'terminer' && (
              <p className="text-sm text-gray-500 mb-4">
                Une demande sera envoyée au responsable pour valider la clôture de cette tâche.
              </p>
            )}

            {demandeError && <p className="text-xs text-red-500 mb-3">{demandeError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDemandeForm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitDemande}
                disabled={submittingDemande}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {submittingDemande ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
