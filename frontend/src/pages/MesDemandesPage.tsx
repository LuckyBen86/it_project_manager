import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMesDemandes } from '../hooks/useMesDemandes.ts';
import type { TypeDemande, StatutDemande } from '../lib/types.ts';

const TYPE_LABELS: Record<TypeDemande, string> = {
  terminer: 'Passer en terminé',
  modifier_duree: 'Modifier la durée',
  modifier_date_debut: 'Modifier la date de début',
};

const STATUT_LABELS: Record<StatutDemande, string> = {
  en_attente: 'En attente',
  valide: 'Validé',
  refuse: 'Refusé',
};

const STATUT_COLORS: Record<StatutDemande, string> = {
  en_attente: 'bg-orange-100 text-orange-700',
  valide: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
};

export default function MesDemandesPage() {
  const { demandes, loading, error, archiverDemande } = useMesDemandes();

  if (loading) return <div className="flex items-center justify-center h-full text-sm text-gray-500">Chargement...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-sm text-red-500">{error}</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Mes demandes</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {demandes.length} demande{demandes.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {demandes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Aucune demande</p>
          </div>
        )}

        {demandes.map((d) => (
          <div key={d.id} className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 flex items-start gap-4">
            {/* Statut */}
            <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full mt-0.5 ${STATUT_COLORS[d.statut]}`}>
              {STATUT_LABELS[d.statut]}
            </span>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-medium text-gray-800">{TYPE_LABELS[d.type]}</p>
                {d.tache && (
                  <span className="text-xs text-gray-400 truncate">
                    {d.tache.titre}
                    {d.tache.projet && <span className="ml-1 text-gray-300">· {d.tache.projet.titre}</span>}
                  </span>
                )}
              </div>

              {/* Détail de la modification */}
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

              {/* Commentaire refus */}
              {d.statut === 'refuse' && d.commentaireRefus && (
                <p className="text-xs text-red-600 mt-1 italic">"{d.commentaireRefus}"</p>
              )}

              <p className="text-xs text-gray-400 mt-1">
                {format(new Date(d.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
              </p>
            </div>

            {/* Archive (uniquement si traitée) */}
            {d.statut !== 'en_attente' && (
              <button
                onClick={() => archiverDemande(d.id)}
                title="Archiver"
                className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
