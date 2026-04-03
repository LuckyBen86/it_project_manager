import { useState, useEffect } from 'react';
import api from '../lib/api.ts';
import type { Categorie } from '../lib/types.ts';

export function useCategories(poleId?: string) {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = poleId ? `?poleId=${poleId}` : '';
    api.get<Categorie[]>(`/categories${params}`)
      .then(({ data }) => { if (!cancelled) setCategories(data); })
      .catch(() => { if (!cancelled) setCategories([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [poleId]);

  return { categories, loading };
}
