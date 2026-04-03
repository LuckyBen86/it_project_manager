import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.ts';
import type { DemandeValidation } from '../lib/types.ts';

export function useDemandesResponsable() {
  const [demandes, setDemandes] = useState<DemandeValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<DemandeValidation[]>('/demandes');
      setDemandes(res.data);
      setError(null);
    } catch {
      setError('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const traiterDemande = async (demandeId: string, action: 'valider' | 'refuser', commentaireRefus?: string) => {
    await api.patch(`/demandes/${demandeId}/traiter`, { action, commentaireRefus });
    await fetch();
  };

  return { demandes, loading, error, refresh: fetch, traiterDemande };
}

export function useDemandesResponsableCount(enabled = true) {
  const [count, setCount] = useState(0);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await api.get<DemandeValidation[]>('/demandes');
      setCount(res.data.length);
    } catch {
      // silencieux
    }
  }, [enabled]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [fetch]);

  return { count, refresh: fetch };
}
