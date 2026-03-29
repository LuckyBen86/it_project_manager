import { useState, useEffect } from 'react';
import api from '../lib/api.ts';
import type { Categorie, TypeCategorie } from '../lib/types.ts';

export function useCategories(type: TypeCategorie) {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<Categorie[]>(`/categories?type=${type}`)
      .then(({ data }) => { if (!cancelled) setCategories(data); })
      .catch(() => { if (!cancelled) setCategories([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type]);

  return { categories, loading };
}
