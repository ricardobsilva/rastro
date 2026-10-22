import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, errorMessage } from '../api/client';
import type { Employee } from '../types';
import { Avatar } from '../ui/Avatar';
import { PinPad } from '../ui/PinPad';
import { useToast } from '../ui/Toast';
import { AdminContext, type PageId } from './context';
import { PAGES } from './pages';

type Me = { manager: Employee; lateToday: number };

const NAV: [PageId, string][] = [['dash', 'Painel'], ['team', 'Equipe'], ['items', 'Itens'], ['cls', 'Checklists'], ['hist', 'Histórico'], ['guide', 'Passo a passo']];

export function AdminApp({ go: navigate = (path: string) => window.location.assign(path) }: { go?: (path: string) => void } = {}) {
  const toast = useToast();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'gate' } | { kind: 'error'; message: string } | ({ kind: 'in' } & Me)>({ kind: 'loading' });
  const [page, setPage] = useState<PageId>('dash');
  const [date, setDate] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    try {
      setState({ kind: 'in', ...(await api.get<Me>('/api/admin/me')) });
    } catch (e) {
      setState(e instanceof ApiError && e.status === 401 ? { kind: 'gate' } : { kind: 'error', message: errorMessage(e) });
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function login(pin: string) {
    try {
      const { manager } = await api.post<{ manager: Employee }>('/api/admin/login', { pin });
      toast(`Acesso liberado · ${manager.name}`);
      await loadMe();
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }

  async function logout() {
    await api.del('/api/admin/login').catch(() => {});
    navigate('/');
  }

  if (state.kind === 'loading') return <div className="gate" aria-busy="true" />;
  if (state.kind === 'error')
    return (
      <div className="gate">
        <div className="gate-card">
          <p className="gate-text">{state.message}</p>
          <button type="button" className="btn btn-primary" onClick={loadMe}>Tentar de novo</button>
        </div>
      </div>
    );
  if (state.kind === 'gate')
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="gate-eyebrow">Área restrita</div>
          <h1 className="gate-title">Rastro · Painel do gestor</h1>
          <p className="gate-text">Configurações e relatórios ficam disponíveis apenas para usuários autorizados.</p>
          <PinPad onComplete={login} />
        </div>
      </div>
    );

  const Page = PAGES[page];
  const go = (p: PageId, opts?: { employeeId?: string }) => {
    setPage(p);
    if (opts?.employeeId) setSelectedEmployee(opts.employeeId);
  };
  const { manager, lateToday } = state;

  return (
    <AdminContext.Provider value={{ manager, date, setDate, selectedEmployee, go, refreshBadge: loadMe }}>
      <div className="admin">
        <aside className="admin-side">
          <div className="eyebrow eyebrow--xs admin-side-label">Gestão</div>
          <nav className="admin-nav" aria-label="Gestão">
            {NAV.map(([id, label]) => (
              <button key={id} type="button" className="admin-nav-btn" aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>
                {label}
                {id === 'dash' && lateToday > 0 && <span className="admin-badge">{lateToday}</span>}
              </button>
            ))}
          </nav>
          <div className="admin-user">
            <Avatar initials={manager.initials} color={manager.color} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="admin-user-name">{manager.name}</div>
              <div className="admin-user-role">{manager.role}</div>
            </div>
            <button type="button" className="admin-logout" onClick={logout}>Sair</button>
          </div>
        </aside>
        <main className="admin-main">
          <Page />
        </main>
      </div>
    </AdminContext.Provider>
  );
}
