import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.ts';
import type { Projet, StatutProjet } from '../lib/types.ts';

export function useProjets() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<Projet[]>('/projets');
      setProjets(data);
    } catch {
      setError('Impossible de charger les projets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const updateStatut = useCallback(async (id: string, statut: StatutProjet) => {
    // Optimistic update
    setProjets((prev) => prev.map((p) => p.id === id ? { ...p, statut } : p));
    try {
      await api.patch(`/projets/${id}`, { statut });
    } catch {
      fetch(); // Rollback
    }
  }, [fetch]);

  const updateGantt = useCallback(async (id: string, updates: { dateDebut?: string; duree?: number }) => {
    setProjets((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
    try {
      await api.patch(`/projets/${id}/gantt`, updates);
    } catch {
      fetch();
    }
  }, [fetch]);

  const updateTacheGantt = useCallback(async (
    projetId: string,
    tacheId: string,
    updates: { dateDebut?: string; duree?: number },
  ) => {
    setProjets((prev) => prev.map((p) =>
      p.id === projetId
        ? { ...p, taches: p.taches.map((t) => t.id === tacheId ? { ...t, ...updates } : t) }
        : p,
    ));
    try {
      await api.patch(`/projets/${projetId}/taches/${tacheId}`, updates);
    } catch {
      fetch();
    }
  }, [fetch]);

  return { projets, loading, error, refresh: fetch, updateStatut, updateGantt, updateTacheGantt };
}
