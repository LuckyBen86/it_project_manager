import { useState, useEffect } from 'react';
import api from '../lib/api.ts';
import type { Ressource } from '../lib/types.ts';

export function useRessources() {
  const [ressources, setRessources] = useState<Ressource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<Ressource[]>('/ressources')
      .then(({ data }) => { if (!cancelled) setRessources(data); })
      .catch(() => { if (!cancelled) setRessources([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { ressources, loading };
}
