import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { Unit } from '../types';
import { PinPad } from '../ui/PinPad';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'locked' } | { kind: 'ok' }
  // O PIN fica só na memória, para gravar a unidade sem pedir de novo.
  | { kind: 'unit'; units: Unit[]; pin: string; error?: string };

type Props = { children: ReactNode; station?: boolean };

/** `station`: computador fixo, que pertence a uma unidade. Celular pessoal não pergunta e vê todas. */
export function DeviceGate({ children, station = false }: Props) {
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
      const { units = [] } = await api.post<{ units?: Unit[] }>('/api/device/authorize', { pin });
      setState(station && units.length > 0 ? { kind: 'unit', units, pin } : { kind: 'ok' });
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }

  async function chooseUnit(unitId: string) {
    if (state.kind !== 'unit') return;
    try {
      await api.put('/api/device/unit', { pin: state.pin, unitId });
      setState({ kind: 'ok' });
    } catch (e) {
      setState({ ...state, error: errorMessage(e) });
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

  if (state.kind === 'unit')
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="gate-eyebrow">Aparelho liberado</div>
          <h1 className="gate-title">Em qual unidade ele fica?</h1>
          <p className="gate-text">Ele vai mostrar só a equipe e os checklists dessa unidade.</p>
          {state.error && <div role="alert" className="banner banner--error">{state.error}</div>}
          <div className="unit-options">
            {state.units.map((u) => (
              <button key={u.id} type="button" className="btn btn-primary" onClick={() => chooseUnit(u.id)}>{u.name}</button>
            ))}
            <button type="button" className="btn btn-secondary" onClick={() => setState({ kind: 'ok' })}>Todas as unidades</button>
          </div>
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
