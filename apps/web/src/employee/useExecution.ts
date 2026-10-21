import { useRef, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useResource } from '../api/useResource';
import { useToast } from '../ui/Toast';
import type { Execution } from './types';

/** Estado de uma execução + ações do funcionário (marcar, observar). */
export function useExecution(executionId: number | null, onChange?: () => void) {
  const toast = useToast();
  const { data: exec, error, setData, reload } = useResource<Execution>(executionId ? `/api/me/executions/${executionId}` : null);
  const [pop, setPop] = useState<string | null>(null);
  const [finishError, setFinishError] = useState('');
  const busy = useRef(new Set<string>());

  async function toggle(itemId: string, done: boolean) {
    if (!exec || busy.current.has(itemId)) return;
    busy.current.add(itemId);
    setFinishError('');
    setPop(itemId);
    setTimeout(() => setPop((p) => (p === itemId ? null : p)), 220);
    try {
      setData(await api.put<Execution>(`/api/me/executions/${exec.id}/items/${itemId}`, { done }));
      onChange?.();
      if (!done) toast('Item desmarcado. A alteração foi registrada no histórico.', 'warn');
    } catch (e) {
      toast(errorMessage(e), 'warn');
    } finally {
      busy.current.delete(itemId);
    }
  }

  /** Devolve true se salvou. */
  async function saveNote(itemId: string, note: string): Promise<boolean> {
    if (!exec) return false;
    try {
      setData(await api.put<Execution>(`/api/me/executions/${exec.id}/items/${itemId}/note`, { note }));
      onChange?.();
      if (note.trim()) toast('Observação salva.');
      return true;
    } catch (e) {
      toast(errorMessage(e), 'warn');
      return false;
    }
  }

  /** Tenta concluir; devolve true se pode sair da tela. */
  async function finish(): Promise<boolean> {
    if (!exec) return false;
    if (exec.total > 0 && exec.done === exec.total) return true;
    try {
      const r = await api.post<{ kind: 'ok' | 'warn'; message: string }>(`/api/me/executions/${exec.id}/finish`);
      toast(r.message, r.kind);
      setFinishError('');
      return true;
    } catch (e) {
      setFinishError(errorMessage(e));
      return false;
    }
  }

  const allDone = !!exec && exec.total > 0 && exec.done === exec.total;

  return { exec, error, reload, setExec: setData, toggle, saveNote, finish, finishError, allDone, pop };
}
