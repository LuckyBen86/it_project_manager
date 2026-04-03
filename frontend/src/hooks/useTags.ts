import { useState, useEffect } from 'react';
import api from '../lib/api.ts';
import type { Tag, TypeTag } from '../lib/types.ts';

export function useTags(type: TypeTag) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<Tag[]>(`/tags?type=${type}`)
      .then(({ data }) => { if (!cancelled) setTags(data); })
      .catch(() => { if (!cancelled) setTags([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type]);

  return { tags, loading };
}
