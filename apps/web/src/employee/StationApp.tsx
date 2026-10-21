import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, errorMessage } from '../api/client';
import { useResource } from '../api/useResource';
import { RESTAURANT } from '../restaurant';
import type { Employee, Session } from '../types';
import { Avatar } from '../ui/Avatar';
import { ProgressRing } from '../ui/ProgressRing';
import { useToast } from '../ui/Toast';
import { barColor, pct, plural } from '../ui/status';
import { ActivityList } from './ActivitiesScreen';
import { ChecklistCard } from './ChecklistCard';
import { ExecItemCard } from './ExecItemCard';
import { NoteEditor } from './NoteEditor';
import { OnDemandList } from './OnDemandList';
import { runMeta } from './RunScreen';
import type { Activity, Team, TeamMember, Today } from './types';
import { useExecution } from './useExecution';

/** Computador fixo compartilhado: troca de pessoa com um toque, sempre mostrando em nome de quem se marca. */
export function StationApp() {
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const team = useResource<Team>('/api/station/team', { pollMs: 30_000 });
  const me = session?.employee ?? null;

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) return window.location.reload();
      toast(errorMessage(e), 'warn');
    },
    [toast],
  );

  useEffect(() => {
    api.get<Session>('/api/session').then(setSession).catch(fail);
  }, [fail]);

  async function login(e: Employee) {
    if (e.id === me?.id) return;
    try {
      setSession(await api.post<Session>('/api/session', { employeeId: e.id }));
      toast(`Olá, ${e.firstName}! Para trocar, toque no seu nome na lista.`);
    } catch (err) {
      fail(err);
    }
  }

  async function logout() {
    try {
      await api.del('/api/session');
      setSession({ employee: null, since: null });
      team.reload();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <div className="station-wrap">
      <div className="station">
        <header className="station-head">
          <div className="station-brand">
            <div className="restaurant-logo station-logo">{RESTAURANT.initials}</div>
            <div>
              <div className="station-name">{RESTAURANT.name}</div>
              <div className="station-sub">Estação compartilhada · com <span>Rastro</span></div>
            </div>
          </div>
          <div className="station-clock">
            <span className="station-time">{team.data?.now ?? '--:--'}</span>
            <span className="station-date">{team.data?.dateLabel}</span>
          </div>
          {me && (
            <div className="station-who">
              <Avatar initials={me.initials} color={me.color} size={34} />
              <span>Marcando como <strong>{me.name}</strong></span>
              <button type="button" className="station-end" onClick={logout}>Encerrar e trocar</button>
            </div>
          )}
        </header>

        {session && !me && <StationIdentify members={team.data?.members ?? []} onPick={login} />}
        {me && <StationMain key={me.id} me={me} members={team.data?.members ?? []} onPick={login} onChange={team.reload} />}
      </div>
    </div>
  );
}

function memberProgress(m: TeamMember) {
  return { prog: m.total ? `${m.done}/${m.total}` : '—', pct: pct(m.done, m.total), bar: m.late ? '#C2502F' : '#1F4D3B' };
}

function StationIdentify({ members, onPick }: { members: TeamMember[]; onPick: (e: Employee) => void }) {
  return (
    <div className="station-identify">
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="station-title">Quem vai marcar tarefas agora?</h1>
        <p className="muted" style={{ fontSize: 17 }}>Toque no seu nome. Ao terminar, toque em “Encerrar e trocar” para o próximo colega.</p>
      </div>
      <div className="station-grid">
        {members.map((m) => {
          const p = memberProgress(m);
          return (
            <button key={m.id} type="button" className="station-card" onClick={() => onPick(m)}>
              <Avatar initials={m.initials} color={m.color} size={72} />
              <span style={{ textAlign: 'center' }}>
                <span className="station-card-name">{m.shortName}</span>
                <span className="station-card-role">{m.role}</span>
              </span>
              <span className="station-card-bar">
                <span className="bar" style={{ height: 6 }}><span className="bar-fill" style={{ display: 'block', width: `${p.pct}%`, background: p.bar }} /></span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.prog}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type MainProps = { me: Employee; members: TeamMember[]; onPick: (e: Employee) => void; onChange: () => void };

function StationMain({ me, members, onPick, onChange }: MainProps) {
  const today = useResource<Today>('/api/me/today', { pollMs: 30_000 });
  const acts = useResource<Activity[]>('/api/me/activities');
  const [selected, setSelected] = useState<number | null>(null);
  const cards = today.data?.cards ?? [];
  const runId = cards.some((c) => c.executionId === selected) ? selected : (cards[0]?.executionId ?? null);

  const refresh = () => {
    today.reload();
    acts.reload();
    onChange();
  };
  const { exec, toggle, saveNote, finish, finishError, allDone, pop } = useExecution(runId, refresh);
  const s = today.data?.summary;

  return (
    <div className="station-main">
      <nav className="station-team" aria-label="Trocar com um toque">
        <div className="eyebrow eyebrow--xs">Trocar com um toque</div>
        {members.map((m) => {
          const cur = m.id === me.id;
          return (
            <button key={m.id} type="button" className={`station-member${cur ? ' is-current' : ''}`} onClick={() => onPick(m)}>
              <Avatar initials={m.initials} color={m.color} size={36} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="station-member-name">{m.shortName}</span>
                <span className={`station-member-sub${cur ? ' is-current' : m.late ? ' is-late' : ''}`}>
                  {cur ? 'Usando agora' : m.late ? plural(m.late, 'atrasada', 'atrasadas') : m.role}
                </span>
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{memberProgress(m).prog}</span>
            </button>
          );
        })}
      </nav>

      <section className="station-day">
        {today.data && s && (
          <>
            <div>
              <h1 className="title-xl">{today.data.greeting}, {me.firstName}!</h1>
              <div className="muted" style={{ marginTop: 4 }}>Você possui {plural(s.total, 'atividade', 'atividades')} para hoje.</div>
            </div>
            <div className="progress-card progress-card--sm">
              <ProgressRing value={s.total ? s.done / s.total : 0} size={76} />
              <div className="progress-card-body">
                <div className="progress-card-title">{s.done} de {s.total} concluídas</div>
                <div className="progress-card-chips">
                  <span className="chip chip--dark">{s.pending} pendentes</span>
                  {s.late > 0 && <span className="chip chip--accent">{s.late} atrasadas</span>}
                </div>
              </div>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <div className="section-label">Seus checklists</div>
              {cards.map((c) => (
                <ChecklistCard key={c.executionId} card={c} compact selected={c.executionId === runId} onOpen={() => setSelected(c.executionId)} />
              ))}
              <OnDemandList compact list={today.data.onDemand} onStarted={(id) => { setSelected(id); today.reload(); }} />
              {cards.length === 0 && <div className="empty">Nenhum checklist atribuído a você hoje.</div>}
            </div>
          </>
        )}
        {acts.data && acts.data.length > 0 && (
          <div>
            <div className="section-label" style={{ paddingBottom: 4 }}>Suas últimas marcações</div>
            <ActivityList compact list={acts.data.slice(0, 5)} />
          </div>
        )}
      </section>

      <section className="station-run">
        {exec ? (
          <>
            <div className="station-run-head">
              <div className="station-run-title">
                <div>
                  <div className="eyebrow eyebrow--sm">Checklist</div>
                  <h2 className="run-title" style={{ fontSize: 28 }}>{exec.name}</h2>
                  <div className="run-meta" style={{ fontSize: 14 }}>{runMeta(exec)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className="run-count" style={{ fontSize: 26 }}>{exec.done}/{exec.total}</span>
                  <button type="button" className="btn btn-primary station-finish" onClick={async () => (await finish()) && (setSelected(null), today.reload())}>
                    {allDone ? 'Voltar para Meu dia' : 'Concluir checklist'}
                  </button>
                </div>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${pct(exec.done, exec.total)}%`, background: barColor(exec.status) }} />
              </div>
            </div>
            <div className="station-run-body">
              {allDone && (
                <div className="banner banner--success">
                  <div className="banner-icon">✓</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Checklist concluído</div>
                    <div style={{ fontSize: 13 }}>Tudo registrado em nome de {me.firstName}. Não esqueça de encerrar para o próximo colega.</div>
                  </div>
                </div>
              )}
              {finishError && <div className="banner banner--error">{finishError}</div>}
              <div className="station-items">
                {exec.items.map((it) => (
                  <ExecItemCard key={it.itemId} large item={it} me={me} pop={pop === it.itemId} onToggle={() => toggle(it.itemId, it.status !== 'done')}>
                    <NoteEditor item={it} onSave={(note) => saveNote(it.itemId, note)} />
                  </ExecItemCard>
                ))}
              </div>
            </div>
          </>
        ) : (
          today.data && <div className="station-norun">Selecione um checklist à esquerda.</div>
        )}
      </section>
    </div>
  );
}
