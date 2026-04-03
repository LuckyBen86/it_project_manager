import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.ts';
import type { Tache, StatutTache } from '../lib/types.ts';

export function useMesTaches() {
  const [taches, setTaches] = useState<Tache[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Tache[]>('/mes-taches');
      setTaches(res.data);
      setError(null);
    } catch {
      setError('Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const updateStatut = async (tacheId: string, statut: StatutTache) => {
    const res = await api.patch<Tache>(`/mes-taches/${tacheId}/statut`, { statut });
    setTaches((prev) => prev.map((t) => (t.id === tacheId ? res.data : t)));
  };

  const addActivite = async (tacheId: string, data: { description: string; date: string; duree: number }) => {
    await api.post(`/mes-taches/${tacheId}/activites`, data);
    await fetch();
  };

  const updateActivite = async (tacheId: string, activiteId: string, data: Partial<{ description: string; date: string; duree: number }>) => {
    await api.patch(`/mes-taches/${tacheId}/activites/${activiteId}`, data);
    await fetch();
  };

  return { taches, loading, error, refresh: fetch, updateStatut, addActivite, updateActivite };
}
