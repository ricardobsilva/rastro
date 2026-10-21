import { useRef, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useResource } from '../api/useResource';
import { useToast } from '../ui/Toast';
import type { Execution } from './types';

/** Estado de uma execução + ações do funcionário (marcar, observar). */
export function useExecution(executionId: number | null) {
  const toast = useToast();
  const { data: exec, error, setData, reload } = useResource<Execution>(executionId ? `/api/me/executions/${executionId}` : null);
  const [pop, setPop] = useState<string | null>(null);
  const busy = useRef(new Set<string>());

  async function toggle(itemId: string, done: boolean) {
    if (!exec || busy.current.has(itemId)) return;
    busy.current.add(itemId);
    setPop(itemId);
    setTimeout(() => setPop((p) => (p === itemId ? null : p)), 220);
    try {
      setData(await api.put<Execution>(`/api/me/executions/${exec.id}/items/${itemId}`, { done }));
      if (!done) toast('Item desmarcado. A alteração foi registrada no histórico.', 'warn');
    } catch (e) {
      toast(errorMessage(e), 'warn');
    } finally {
      busy.current.delete(itemId);
    }
  }

  return { exec, error, reload, setExec: setData, toggle, pop };
}
