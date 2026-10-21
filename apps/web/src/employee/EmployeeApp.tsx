import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, errorMessage } from '../api/client';
import type { Employee, Session } from '../types';
import { useToast } from '../ui/Toast';
import { IdentifyScreen } from './IdentifyScreen';
import { ResumeScreen } from './ResumeScreen';
import { RunScreen } from './RunScreen';
import { TodayScreen } from './TodayScreen';

type Screen = 'loading' | 'identify' | 'resume' | 'today' | 'run';

export function EmployeeApp() {
  const toast = useToast();
  const [screen, setScreen] = useState<Screen>('loading');
  const [me, setMe] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runId, setRunId] = useState<number | null>(null);

  const fail = useCallback(
    (e: unknown) => {
      // Aparelho perdeu a autorização: recarrega para cair na tela de liberação.
      if (e instanceof ApiError && e.status === 401) return window.location.reload();
      toast(errorMessage(e), 'warn');
    },
    [toast],
  );

  const loadEmployees = useCallback(() => api.get<Employee[]>('/api/employees').then(setEmployees).catch(fail), [fail]);

  useEffect(() => {
    api
      .get<Session>('/api/session')
      .then((s) => {
        if (s.employee) {
          setMe(s.employee);
          setScreen('resume');
        } else {
          setScreen('identify');
          return loadEmployees();
        }
      })
      .catch(fail);
  }, [fail, loadEmployees]);

  async function login(e: Employee) {
    try {
      const s = await api.post<Session>('/api/session', { employeeId: e.id });
      setMe(s.employee);
      setScreen('today');
      toast(`Olá, ${e.firstName}! Para trocar, toque na sua foto.`);
    } catch (err) {
      fail(err);
      loadEmployees();
    }
  }

  async function logout() {
    try {
      await api.del('/api/session');
      setMe(null);
      setScreen('identify');
      loadEmployees();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <div className="phone">
      {screen === 'identify' && <IdentifyScreen employees={employees} onPick={login} />}
      {screen === 'resume' && me && <ResumeScreen me={me} onContinue={() => setScreen('today')} onSwitch={logout} />}
      {screen === 'today' && me && (
        <TodayScreen me={me} onOpen={(id) => { setRunId(id); setScreen('run'); }} onSwitch={logout} />
      )}
      {screen === 'run' && me && runId !== null && (
        <RunScreen executionId={runId} me={me} onBack={() => setScreen('today')} onSwitch={logout} onFinished={() => setScreen('today')} />
      )}
    </div>
  );
}
