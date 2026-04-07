import { useState, useEffect } from 'react';
import api from '../lib/api.ts';
import type { Tag, TypeTag } from '../lib/types.ts';

export function useTags(type: TypeTag, poleId?: string) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ type });
    if (poleId) params.set('poleId', poleId);
    api.get<Tag[]>(`/tags?${params.toString()}`)
      .then(({ data }) => { if (!cancelled) setTags(data); })
      .catch(() => { if (!cancelled) setTags([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type, poleId]);

  return { tags, loading };
}
