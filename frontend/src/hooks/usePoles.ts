import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.ts';
import type { Pole } from '../lib/types.ts';

export function usePoles() {
  const [poles, setPoles] = useState<Pole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Pole[]>('/poles');
      setPoles(res.data);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { poles, loading, refresh: fetch };
}
