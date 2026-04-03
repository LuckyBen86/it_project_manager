import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.ts';
import type { DemandeValidation, TypeDemande } from '../lib/types.ts';

export function useMesDemandes() {
  const [demandes, setDemandes] = useState<DemandeValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<DemandeValidation[]>('/mes-demandes');
      setDemandes(res.data);
      setError(null);
    } catch {
      setError('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createDemande = async (tacheId: string, type: TypeDemande, valeurDemandee?: string) => {
    await api.post(`/mes-taches/${tacheId}/demandes`, { type, valeurDemandee });
    await fetch();
  };

  const archiverDemande = async (demandeId: string) => {
    await api.patch(`/mes-demandes/${demandeId}/archiver`);
    setDemandes((prev) => prev.filter((d) => d.id !== demandeId));
  };

  return { demandes, loading, error, refresh: fetch, createDemande, archiverDemande };
}

export function useMesDemandesCount() {
  const [count, setCount] = useState(0);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<{ count: number }>('/mes-demandes/count');
      setCount(res.data.count);
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [fetch]);

  return { count, refresh: fetch };
}
