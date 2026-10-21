import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, errorMessage } from '../api/client';
import type { Employee, Session } from '../types';
import { useToast } from '../ui/Toast';
import { ActivitiesScreen } from './ActivitiesScreen';
import { IdentifyScreen } from './IdentifyScreen';
import { ProfileScreen } from './ProfileScreen';
import { ResumeScreen } from './ResumeScreen';
import { RunScreen } from './RunScreen';
import { SwitchSheet } from './SwitchSheet';
import { type Tab, TabBar } from './TabBar';
import { TodayScreen } from './TodayScreen';

type Screen = 'loading' | 'identify' | 'resume' | 'run' | Tab;

export function EmployeeApp() {
  const toast = useToast();
  const [screen, setScreen] = useState<Screen>('loading');
  const [session, setSession] = useState<Session>({ employee: null, since: null });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const me = session.employee;

  const fail = useCallback(
    (e: unknown) => {
      // Aparelho ou sessão perdidos: recarrega para cair na tela certa.
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
        setSession(s);
        if (s.employee) return setScreen('resume');
        setScreen('identify');
        return loadEmployees();
      })
      .catch(fail);
  }, [fail, loadEmployees]);

  async function login(e: Employee) {
    setSwitchOpen(false);
    try {
      setSession(await api.post<Session>('/api/session', { employeeId: e.id }));
      setRunId(null);
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
      setSession({ employee: null, since: null });
      setRunId(null);
      setScreen('identify');
      loadEmployees();
    } catch (err) {
      fail(err);
    }
  }

  const openSwitch = () => {
    setSwitchOpen(true);
    loadEmployees();
  };

  const openRun = (id: number) => {
    setRunId(id);
    setScreen('run');
  };
  const isTab = screen === 'today' || screen === 'activities' || screen === 'profile';

  return (
    <div className="phone">
      <div className="phone-scroll">
        {screen === 'identify' && <IdentifyScreen employees={employees} onPick={login} />}
        {screen === 'resume' && me && <ResumeScreen me={me} onContinue={() => setScreen('today')} onSwitch={openSwitch} />}
        {screen === 'today' && me && <TodayScreen me={me} onOpen={openRun} onSwitch={openSwitch} />}
        {screen === 'activities' && me && <ActivitiesScreen />}
        {screen === 'profile' && me && <ProfileScreen me={me} since={session.since} onSwitch={openSwitch} onLogout={logout} />}
        {screen === 'run' && me && runId !== null && (
          <RunScreen executionId={runId} me={me} onBack={() => setScreen('today')} onSwitch={openSwitch} onFinished={() => setScreen('today')} />
        )}
      </div>
      {me && isTab && <TabBar current={screen} onChange={setScreen} />}
      {me && switchOpen && <SwitchSheet employees={employees} currentId={me.id} onPick={login} onClose={() => setSwitchOpen(false)} />}
    </div>
  );
}
