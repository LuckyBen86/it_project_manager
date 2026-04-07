import { useState, useEffect, useCallback } from 'react';
import { startOfWeek, addWeeks, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../lib/api.ts';
import type { ChargeData } from '../lib/types.ts';

function defaultRange() {
  const from = startOfWeek(new Date(), { locale: fr });
  const to   = addWeeks(from, 7);
  return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
}

export function useCharge() {
  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState<ChargeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get<ChargeData>(`/charge?from=${range.from}&to=${range.to}`);
      setData(res);
    } catch {
      setError('Impossible de charger les données de charge');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, range, setRange };
}
