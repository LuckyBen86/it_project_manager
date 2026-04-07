import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.ts';
import type { Activite } from '../lib/types.ts';

export function useActivitesTache(projetId: string, tacheId: string | undefined, open: boolean) {
  const [activites, setActivites] = useState<Activite[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!open || !tacheId) { setActivites([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get<Activite[]>(`/projets/${projetId}/taches/${tacheId}/activites`);
      setActivites(data);
    } finally {
      setLoading(false);
    }
  }, [projetId, tacheId, open]);

  useEffect(() => { fetch(); }, [fetch]);

  const addActivite = async (payload: { description: string; date: string; duree: number; ressourceId: string }) => {
    await api.post(`/projets/${projetId}/taches/${tacheId}/activites`, payload);
    await fetch();
  };

  const deleteActivite = async (activiteId: string) => {
    await api.delete(`/projets/${projetId}/taches/${tacheId}/activites/${activiteId}`);
    await fetch();
  };

  return { activites, loading, addActivite, deleteActivite };
}
