import { api, errorMessage } from '../api/client';
import { useToast } from '../ui/Toast';
import { plural } from '../ui/status';
import type { OnDemand } from './types';

type Props = { list: OnDemand[]; onStarted: (executionId: number) => void; compact?: boolean };

export function OnDemandList({ list, onStarted, compact }: Props) {
  const toast = useToast();

  async function start(c: OnDemand) {
    try {
      const { executionId } = await api.post<{ executionId: number }>(`/api/me/ondemand/${c.checklistId}/start`);
      onStarted(executionId);
    } catch (e) {
      toast(errorMessage(e), 'warn');
    }
  }

  return (
    <>
      {list.map((c) => (
        <div key={c.checklistId} className={`ondemand${compact ? ' ondemand--compact' : ''}`}>
          <div>
            <div className="ondemand-name">{c.name}</div>
            <div className="ondemand-meta">
              {compact ? 'Sob demanda' : [plural(c.itemCount, 'item', 'itens'), c.description].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button type="button" className="btn-sm btn-tint" aria-label={`Iniciar ${c.name}`} onClick={() => start(c)}>
            Iniciar
          </button>
        </div>
      ))}
    </>
  );
}
