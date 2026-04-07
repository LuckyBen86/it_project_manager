import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.ts';
import type { ProjetCorbeille, TacheCorbeille } from '../lib/types.ts';

interface CorbeilleData {
  projets: ProjetCorbeille[];
  taches: TacheCorbeille[];
}

function RelativeTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return <span>aujourd'hui</span>;
  if (days === 1) return <span>hier</span>;
  return <span>il y a {days} jours</span>;
}

export default function CorbeillePage() {
  const [data, setData] = useState<CorbeilleData>({ projets: [], taches: [] });
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: d } = await api.get<CorbeilleData>('/corbeille');
      setData(d);
    } catch {
      setError('Impossible de charger la corbeille');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const restaurerProjet = async (id: string) => {
    setRestoring(id);
    setError(null);
    try {
      await api.post(`/corbeille/projets/${id}/restaurer`);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erreur lors de la restauration');
    } finally {
      setRestoring(null);
    }
  };

  const restaurerTache = async (id: string) => {
    setRestoring(id);
    setError(null);
    try {
      await api.post(`/corbeille/taches/${id}/restaurer`);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erreur lors de la restauration');
    } finally {
      setRestoring(null);
    }
  };

  const isEmpty = data.projets.length === 0 && data.taches.length === 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Chargement...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mes éléments supprimés</h1>
            <p className="text-sm text-gray-500 mt-0.5">Restaurez un projet ou une tâche que vous avez supprimé</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <p className="text-sm font-medium">La corbeille est vide</p>
            <p className="text-xs mt-1">Les projets et tâches que vous supprimez apparaîtront ici</p>
          </div>
        )}

        {/* Projets supprimés */}
        {data.projets.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Projets ({data.projets.length})
            </h2>
            <div className="space-y-2">
              {data.projets.map((p) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.titre}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">
                        Supprimé <RelativeTime iso={p.deletedAt} />
                      </span>
                      {p.taches.length > 0 && (
                        <span className="text-xs text-blue-500">
                          + {p.taches.length} tâche{p.taches.length > 1 ? 's' : ''} restaurée{p.taches.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => restaurerProjet(p.id)}
                    disabled={restoring === p.id}
                    className="shrink-0 text-sm px-3 py-1.5 rounded-lg font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {restoring === p.id ? '...' : 'Restaurer'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tâches supprimées indépendamment */}
        {data.taches.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Tâches ({data.taches.length})
            </h2>
            <div className="space-y-2">
              {data.taches.map((t) => (
                <div key={t.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.titre}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">
                        Supprimé <RelativeTime iso={t.deletedAt} />
                      </span>
                      {t.projet && (
                        <span className="text-xs text-gray-500 truncate">
                          Projet : {t.projet.titre}
                        </span>
                      )}
                      {t.activites.length > 0 && (
                        <span className="text-xs text-green-600">
                          {t.activites.length} activité{t.activites.length > 1 ? 's' : ''} restaurée{t.activites.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => restaurerTache(t.id)}
                    disabled={restoring === t.id}
                    className="shrink-0 text-sm px-3 py-1.5 rounded-lg font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {restoring === t.id ? '...' : 'Restaurer'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
