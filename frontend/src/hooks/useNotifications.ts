import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.ts';
import type { NotificationsResponse } from '../lib/types.ts';

const EMPTY: NotificationsResponse = { count: 0, items: [] };

export function useNotifications() {
  const [data, setData] = useState<NotificationsResponse>(EMPTY);

  const fetch = useCallback(async () => {
    try {
      const { data: res } = await api.get<NotificationsResponse>('/notifications');
      setData(res);
    } catch {
      setData(EMPTY);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 60_000);
    return () => clearInterval(id);
  }, [fetch]);

  return { ...data, refresh: fetch };
}
