import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { PinPad } from '../ui/PinPad';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'locked' } | { kind: 'ok' };

export function DeviceGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const check = useCallback(() => {
    setState({ kind: 'loading' });
    api
      .get<{ authorized: boolean }>('/api/device')
      .then((r) => setState({ kind: r.authorized ? 'ok' : 'locked' }))
      .catch((e) => setState({ kind: 'error', message: errorMessage(e) }));
  }, []);

  useEffect(check, [check]);

  async function authorize(pin: string) {
    try {
      await api.post('/api/device/authorize', { pin });
      setState({ kind: 'ok' });
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }

  if (state.kind === 'ok') return <>{children}</>;
  if (state.kind === 'loading') return <div className="gate" aria-busy="true" />;
  if (state.kind === 'error')
    return (
      <div className="gate">
        <div className="gate-card">
          <p className="gate-text">{state.message}</p>
          <button type="button" className="btn btn-primary" onClick={check}>
            Tentar de novo
          </button>
        </div>
      </div>
    );

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-eyebrow">Primeiro acesso</div>
        <h1 className="gate-title">Liberar este aparelho</h1>
        <p className="gate-text">
          Peça ao gestor para digitar o PIN. Depois disso, a equipe só precisa tocar no próprio nome.
        </p>
        <PinPad onComplete={authorize} />
        <div className="brand-sign">
          com <span>Rastro</span>
        </div>
      </div>
    </div>
  );
}
