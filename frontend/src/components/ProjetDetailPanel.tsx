import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Modal from './Modal.tsx';
import TacheFormModal from './TacheFormModal.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';
import type { Projet, Tache } from '../lib/types.ts';
import { STATUT_LABELS, STATUT_COLORS } from '../lib/types.ts';
import api from '../lib/api.ts';

const STATUT_TACHE_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' };
const STATUT_TACHE_COLORS = {
  a_faire: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-orange-100 text-orange-700',
  termine: 'bg-green-100 text-green-700',
};

interface Props {
  open: boolean;
  onClose: () => void;
  projet: Projet;
  isResponsable: boolean;
  onRefresh: () => void;
}

export default function ProjetDetailPanel({ open, onClose, projet, isResponsable, onRefresh }: Props) {
  const [tacheForm, setTacheForm] = useState<{ open: boolean; tache?: Tache }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Tache | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  // Gestion dépendances
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [selectedPrecedentId, setSelectedPrecedentId] = useState('');
  const [savingDep, setSavingDep] = useState(false);

  const handleDeleteTache = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/projets/${projet.id}/taches/${deleteTarget.id}`);
      onRefresh();
      setDeleteTarget(null);
      setDeleteError(undefined);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddDependance = async (tacheId: string) => {
    if (!selectedPrecedentId) return;
    setSavingDep(true);
    try {
      await api.post(`/projets/${projet.id}/taches/${tacheId}/dependances`, {
        precedentId: selectedPrecedentId,
      });
      onRefresh();
      setLinkingTaskId(null);
      setSelectedPrecedentId('');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Erreur lors de l\'ajout de la dépendance');
    } finally {
      setSavingDep(false);
    }
  };

  const handleRemoveDependance = async (tacheId: string, precedentId: string) => {
    try {
      await api.delete(`/projets/${projet.id}/taches/${tacheId}/dependances/${precedentId}`);
      onRefresh();
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={projet.titre} size="lg">
        {/* Infos projet */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[projet.statut]}`}>
              {STATUT_LABELS[projet.statut]}
            </span>
            {projet.pole && (
              <span className="text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
                {projet.pole.nom}
              </span>
            )}
            {projet.tags.map((t) => (
              <span key={t.id} className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                {t.nom}
              </span>
            ))}
            {projet.categories?.map((c) => (
              <span key={c.id} className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                {c.nom}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-1">
            {projet.referent && (
              <span>Référent : <strong className="text-gray-700">{projet.referent.nom}</strong></span>
            )}
            {projet.dateButoire && (
              <span>Butoire : <strong className="text-gray-700">{format(new Date(projet.dateButoire), 'dd MMM yyyy', { locale: fr })}</strong></span>
            )}
            {projet.duree && (
              <span>Durée estimée : <strong className="text-gray-700">{projet.duree} j</strong></span>
            )}
            {(() => {
              const dureeReelle = projet.taches.reduce((s, t) => s + (t.duree ?? 0), 0);
              return dureeReelle > 0 ? (
                <span>Durée réelle : <strong className="text-gray-700">{dureeReelle} j</strong></span>
              ) : null;
            })()}
            {(() => {
              const tempsConsomme = projet.taches.reduce(
                (s, t) => s + (t.activites ?? []).reduce((sa, a) => sa + a.duree, 0), 0
              );
              return tempsConsomme > 0 ? (
                <span>Temps consommé : <strong className="text-gray-700">{tempsConsomme.toFixed(2)} j</strong></span>
              ) : null;
            })()}
          </div>

          {projet.description && (
            <p className="text-sm text-gray-600 mt-1">{projet.description}</p>
          )}
        </div>

        {/* Header tâches */}
        <div className="flex items-center justify-between mb-3 -mx-1 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <span className="w-1 h-3.5 bg-brand-500 rounded-full inline-block" />
            Tâches
            <span className="text-gray-400 font-normal normal-case">
              {projet.taches.filter((t) => t.statut === 'termine').length}/{projet.taches.length}
            </span>
          </h3>
          {isResponsable && (
            <button
              onClick={() => setTacheForm({ open: true })}
              className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
            >
              + Nouvelle tâche
            </button>
          )}
        </div>

        {/* Liste tâches */}
        {projet.taches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune tâche pour ce projet</p>
        ) : (
          <div className="space-y-2">
            {projet.taches.map((tache) => {
              const autresTaches = projet.taches.filter(
                (t) => t.id !== tache.id && !tache.dependances.some((d) => d.precedentId === t.id),
              );
              const isLinking = linkingTaskId === tache.id;

              return (
                <div
                  key={tache.id}
                  className="p-3 border border-gray-200 rounded-lg group hover:border-gray-300 transition-colors"
                >
                  {/* Ligne principale */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">{tache.titre}</span>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${STATUT_TACHE_COLORS[tache.statut]}`}>
                          {STATUT_TACHE_LABELS[tache.statut]}
                        </span>
                      </div>

                      {tache.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{tache.description}</p>
                      )}

                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        {tache.duree && <span>{tache.duree} j</span>}
                        {tache.ressources.length > 0 && (
                          <span>{tache.ressources.map((r) => r.ressource.nom).join(', ')}</span>
                        )}
                      </div>
                    </div>

                    {isResponsable && (
                      <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => setTacheForm({ open: true, tache })}
                          className="text-xs px-2 py-1 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tache)}
                          className="text-xs px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dépendances */}
                  {(tache.dependances.length > 0 || isResponsable) && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-gray-400">Commence après la tâche :</span>

                        {tache.dependances.map((dep) => (
                          <span
                            key={dep.precedentId}
                            className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full"
                          >
                            {dep.precedent.titre}
                            {isResponsable && (
                              <button
                                onClick={() => handleRemoveDependance(tache.id, dep.precedentId)}
                                className="hover:text-red-500 transition-colors leading-none"
                                title="Supprimer la dépendance"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}

                        {isResponsable && !isLinking && autresTaches.length > 0 && (
                          <button
                            onClick={() => { setLinkingTaskId(tache.id); setSelectedPrecedentId(''); }}
                            className="text-xs text-gray-400 hover:text-brand-600 border border-dashed border-gray-300 hover:border-brand-400 px-2 py-0.5 rounded-full transition-colors"
                          >
                            + Lier
                          </button>
                        )}

                        {isLinking && (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={selectedPrecedentId}
                              onChange={(e) => setSelectedPrecedentId(e.target.value)}
                              className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-brand-400"
                              autoFocus
                            >
                              <option value="">— Choisir —</option>
                              {autresTaches.map((t) => (
                                <option key={t.id} value={t.id}>{t.titre}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAddDependance(tache.id)}
                              disabled={!selectedPrecedentId || savingDep}
                              className="text-xs px-2 py-0.5 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-40 transition-colors"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setLinkingTaskId(null)}
                              className="text-xs px-2 py-0.5 text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <TacheFormModal
        open={tacheForm.open}
        onClose={() => setTacheForm({ open: false })}
        onSaved={onRefresh}
        projetId={projet.id}
        tache={tacheForm.tache}
        projetDateDebut={projet.dateDebut}
        projetTaches={projet.taches}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(undefined); }}
        onConfirm={handleDeleteTache}
        title="Supprimer la tâche"
        message={`Confirmer la suppression de "${deleteTarget?.titre}" ? Cette action est irréversible.`}
        loading={deleting}
        error={deleteError}
      />
    </>
  );
}
