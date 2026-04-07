import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDemandesResponsable } from '../hooks/useDemandesResponsable.ts';
import type { DemandeValidation, TypeDemande } from '../lib/types.ts';

const TYPE_LABELS: Record<TypeDemande, string> = {
  terminer: 'Passer en terminé',
  modifier_duree: 'Modifier la durée',
  modifier_date_debut: 'Modifier la date de début',
};

interface RefusModal {
  demande: DemandeValidation;
  commentaire: string;
}

export default function DemandesResponsablePage() {
  const { demandes, loading, error, traiterDemande } = useDemandesResponsable();
  const [processing, setProcessing] = useState<string | null>(null);
  const [refusModal, setRefusModal] = useState<RefusModal | null>(null);

  const handleValider = async (id: string) => {
    setProcessing(id);
    try {
      await traiterDemande(id, 'valider');
    } finally {
      setProcessing(null);
    }
  };

  const handleRefuser = async () => {
    if (!refusModal) return;
    setProcessing(refusModal.demande.id);
    try {
      await traiterDemande(refusModal.demande.id, 'refuser', refusModal.commentaire || undefined);
      setRefusModal(null);
    } finally {
      setProcessing(null);
    }
  };

  // Grouper par projet
  const grouped = demandes.reduce<Record<string, { titre: string; items: DemandeValidation[] }>>((acc, d) => {
    const pid = d.tache?.projet?.id ?? 'inconnu';
    const ptitle = d.tache?.projet?.titre ?? 'Projet inconnu';
    if (!acc[pid]) acc[pid] = { titre: ptitle, items: [] };
    acc[pid].items.push(d);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-full text-sm text-gray-500">Chargement...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-sm text-red-500">{error}</div>;

  return (
    <>
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Demandes en attente</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {demandes.length} demande{demandes.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {Object.keys(grouped).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Aucune demande en attente</p>
          </div>
        )}

        {Object.entries(grouped).map(([pid, group]) => (
          <div key={pid}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {group.titre}
            </h3>

            <div className="space-y-2">
              {group.items.map((d) => (
                <div key={d.id} className="bg-white border border-orange-200 border-l-4 border-l-orange-400 rounded-xl shadow-sm px-4 py-3 flex items-start gap-4">
                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-semibold text-gray-800">{TYPE_LABELS[d.type]}</p>
                      <span className="text-xs text-gray-500">sur</span>
                      <p className="text-sm text-gray-700 truncate">{d.tache?.titre}</p>
                    </div>

                    {/* Détail de la modification demandée */}
                    {d.type === 'modifier_duree' && d.valeurDemandee && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Durée : <span className="line-through text-gray-400">{d.tache?.duree ?? '—'} j</span>
                        {' → '}
                        <span className="font-medium text-gray-700">{d.valeurDemandee} j</span>
                      </p>
                    )}
                    {d.type === 'modifier_date_debut' && d.valeurDemandee && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Date de début : <span className="line-through text-gray-400">{d.tache?.dateDebut ? format(new Date(d.tache.dateDebut), 'dd/MM/yyyy', { locale: fr }) : '—'}</span>
                        {' → '}
                        <span className="font-medium text-gray-700">{format(new Date(d.valeurDemandee), 'dd/MM/yyyy', { locale: fr })}</span>
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-1">
                      Demandé par <span className="font-medium text-gray-600">{d.auteur?.nom}</span>
                      {' · '}{format(new Date(d.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex gap-2">
                    <button
                      onClick={() => handleValider(d.id)}
                      disabled={processing === d.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Valider
                    </button>
                    <button
                      onClick={() => setRefusModal({ demande: d, commentaire: '' })}
                      disabled={processing === d.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Modal refus */}
    {refusModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Refuser la demande</h3>
          <p className="text-sm text-gray-500 mb-4">
            "{TYPE_LABELS[refusModal.demande.type]}" sur <span className="font-medium">{refusModal.demande.tache?.titre}</span>
          </p>
          <label className="block text-xs font-medium text-gray-600 mb-1">Commentaire (optionnel)</label>
          <textarea
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 resize-none"
            rows={3}
            placeholder="Raison du refus..."
            value={refusModal.commentaire}
            onChange={(e) => setRefusModal((prev) => prev ? { ...prev, commentaire: e.target.value } : null)}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setRefusModal(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleRefuser}
              disabled={processing === refusModal.demande.id}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {processing === refusModal.demande.id ? 'Refus...' : 'Confirmer le refus'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
