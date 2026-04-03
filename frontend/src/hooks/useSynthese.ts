import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.ts';

export interface SyntheseData {
  taches: {
    total: number;
    termine: number;
    enCours: number;
    aFaire: number;
    enDepassement: number;
    enRetard: number;
    prochaineEcheance: number;
    sansDonnees: number;
  };
  projets: {
    total: number;
    enCours: number;
    termine: number;
    enDepassement: number;
    enRetard: number;
    prochaineEcheance: number;
  } | null;
  demandes: { enAttente: number };
}

export function useSynthese() {
  const [data, setData] = useState<SyntheseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<SyntheseData>('/synthese');
      setData(res.data);
      setError(null);
    } catch {
      setError('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refresh: fetch };
}
