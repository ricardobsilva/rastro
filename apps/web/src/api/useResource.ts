import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, errorMessage } from './client';

type Options = { pollMs?: number };

/** GET com recarga manual e polling opcional. 401 recarrega a página (aparelho/sessão perdidos). */
export function useResource<T>(url: string | null, { pollMs }: Options = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!url) return;
    try {
      const d = await api.get<T>(url);
      if (!alive.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return window.location.reload();
      if (alive.current) setError(errorMessage(e));
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    reload();
    const id = pollMs ? setInterval(reload, pollMs) : undefined;
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [reload, pollMs]);

  return { data, error, reload, setData };
}
