import { useState, useEffect } from 'react';
import api from '../lib/api.ts';
import type { Logiciel } from '../lib/types.ts';

export function useLogiciels() {
  const [logiciels, setLogiciels] = useState<Logiciel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<Logiciel[]>('/logiciels')
      .then(({ data }) => { if (!cancelled) setLogiciels(data); })
      .catch(() => { if (!cancelled) setLogiciels([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { logiciels, loading };
}
