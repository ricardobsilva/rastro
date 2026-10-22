import { GROUPS, MANAGER_GROUP, firstName } from '@rastro/domain';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useResource } from '../api/useResource';
import { useAdmin } from './context';
import type { AdminChecklist, AdminEmployee, AdminItem } from './types';

type When = 'daily' | 'weekdays' | 'ondemand';
type NewPerson = { name: string; group: string };
type Answers = { name: string; tasks: string[]; people: NewPerson[]; roles: string[]; when: When | null; days: number[]; dueTime: string };
type Step = 'welcome' | 'name' | 'tasks' | 'team' | 'who' | 'when' | 'time' | 'review' | 'done';

const EMPTY: Answers = { name: '', tasks: [], people: [], roles: [], when: null, days: [], dueTime: '' };
/** Gestor precisa de PIN, então é cadastrado na página Equipe, não aqui. */
const TEAM_GROUPS = GROUPS.filter((g) => g !== MANAGER_GROUP);
export const NAME_IDEAS = [
  'Abertura do restaurante', 'Fechamento do restaurante', 'Limpeza da cozinha', 'Limpeza dos banheiros',
  'Abertura do salão', 'Fechamento da cozinha', 'Fechamento do bar', 'Conferência da geladeira',
  'Recebimento de mercadorias', 'Limpeza semanal', 'Troca de turno', 'Preparação do almoço',
];
const MAX_NAME_IDEAS = 4;
const TIMES = ['07:00', '08:00', '10:00', '11:00', '12:00', '15:00', '18:00', '22:00', '23:00'];
const DAYS: [number, string][] = [[1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado'], [0, 'Domingo']];
const MAX_SUGGESTIONS = 8;

const norm = (s: string) => s.trim().toLowerCase();
/** "João, Ana e Rafael" */
const joinNames = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`);

function whenText(a: Answers) {
  if (a.when === 'ondemand') return 'só quando alguém pedir';
  const days = a.when === 'daily' ? 'todos os dias' : joinNames(DAYS.filter(([d]) => a.days.includes(d)).map(([, l]) => l.toLowerCase()));
  return `${days}, até ${a.dueTime}`;
}

/**
 * Assistente para quem tem pouca intimidade com tecnologia: uma pergunta por tela,
 * letras grandes, sem arrastar nada. Cria a lista de uma vez só no fim.
 */
export function GuidePage() {
  const { go } = useAdmin();
  const emps = useResource<AdminEmployee[]>('/api/admin/employees');
  const items = useResource<AdminItem[]>('/api/admin/items');
  const cls = useResource<AdminChecklist[]>('/api/admin/checklists');
  const [step, setStep] = useState<Step>('welcome');
  const [a, setA] = useState<Answers>(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<AdminChecklist | null>(null);

  const order: Step[] = ['name', 'tasks', 'team', 'who', 'when', ...(a.when === 'ondemand' ? [] : (['time'] as Step[])), 'review'];
  const set = (p: Partial<Answers>) => {
    setA((x) => ({ ...x, ...p }));
    setError('');
  };
  const move = (to: Step) => {
    setStep(to);
    setError('');
  };
  const back = () => move(step === 'name' ? 'welcome' : order[order.indexOf(step) - 1]!);

  const current = (group: string) => (emps.data ?? []).filter((e) => e.active && e.group === group).map((e) => e.firstName);
  const people = (group: string, list = a.people) => [...current(group), ...list.filter((p) => p.group === group).map((p) => firstName(p.name))];

  function addPerson(p: NewPerson): string {
    const key = norm(p.name);
    const known = (emps.data ?? []).find((e) => e.active && norm(e.name) === key)?.name ?? a.people.find((x) => norm(x.name) === key)?.name;
    if (known) return `${known} já está na equipe.`;
    set({ people: [...a.people, p] });
    return '';
  }

  /** Tirar a única pessoa de uma função já escolhida desmarca a função. */
  function removePerson(name: string) {
    const list = a.people.filter((p) => p.name !== name);
    set({ people: list, roles: a.roles.filter((r) => people(r, list).length > 0) });
  }

  /** Mensagem do que falta responder neste passo, ou '' se pode seguir. */
  function missing(): string {
    if (step === 'name') {
      if (!a.name.trim()) return 'Escreva o nome da lista.';
      if (cls.data?.some((c) => norm(c.name) === norm(a.name))) return 'Já existe uma lista com esse nome. Escolha outro.';
    }
    if (step === 'tasks' && a.tasks.length === 0) return 'Escreva pelo menos uma tarefa.';
    if (step === 'who' && a.roles.length === 0) return 'Escolha quem vai fazer.';
    if (step === 'when') {
      if (!a.when) return 'Escolha uma das opções.';
      if (a.when === 'weekdays' && a.days.length === 0) return 'Escolha pelo menos um dia.';
    }
    if (step === 'time' && !/^\d{2}:\d{2}$/.test(a.dueTime)) return 'Escolha um horário.';
    return '';
  }

  function next() {
    const msg = missing();
    if (msg) return setError(msg);
    move(order[order.indexOf(step) + 1]!);
  }

  async function create() {
    setBusy(true);
    try {
      const saved = await api.post<AdminChecklist>('/api/admin/checklists/guided', {
        name: a.name.trim(),
        tasks: a.tasks,
        roles: a.roles,
        period: a.when,
        days: a.when === 'weekdays' ? [...a.days].sort((x, y) => x - y) : [],
        dueTime: a.when === 'ondemand' ? null : a.dueTime,
        newEmployees: a.people,
      });
      setCreated(saved);
      cls.reload();
      items.reload();
      emps.reload();
      move('done');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setA(EMPTY);
    setCreated(null);
    move('name');
  }

  const ideas = NAME_IDEAS.filter((n) => !cls.data?.some((c) => norm(c.name) === norm(n))).slice(0, MAX_NAME_IDEAS);
  const pos = order.indexOf(step);
  const counter = pos >= 0 ? `Passo ${pos + 1} de ${order.length}` : null;
  const nav = (primary: ReactNode = <button type="button" className="guide-btn guide-btn--primary" onClick={next}>Próximo</button>) => (
    <div className="guide-nav">
      <button type="button" className="guide-btn" onClick={back}>Voltar</button>
      {primary}
    </div>
  );

  return (
    <div className="guide">
      <div className="guide-card">
        {counter && <div className="guide-counter">{counter}</div>}

        {step === 'welcome' && (
          <>
            <Title step={step}>Vamos criar uma lista de tarefas juntos</Title>
            <p className="guide-text">
              Uma lista de tarefas (checklist) diz à sua equipe o que precisa ser feito, por quem e até que horas.
              Vou fazer algumas perguntas simples, uma de cada vez. Leva uns 3 minutos.
            </p>
            <p className="guide-text">Pode voltar a qualquer momento. Nada é salvo até você conferir tudo no final.</p>
            <div className="guide-nav guide-nav--end">
              <button type="button" className="guide-btn guide-btn--primary" onClick={() => move('name')}>Começar</button>
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <Title step={step}>Como vai se chamar esta lista?</Title>
            <p className="guide-text">Um nome curto que todos entendam. {ideas.length ? 'Toque numa ideia ou escreva o seu.' : 'Escreva o nome abaixo.'}</p>
            {ideas.length > 0 && (
              <div className="guide-choices">
                {ideas.map((n) => (
                  <button key={n} type="button" className="guide-choice" data-testid="guide-name-idea" aria-pressed={a.name === n} onClick={() => set({ name: n })}>{n}</button>
                ))}
              </div>
            )}
            <label className="guide-label" htmlFor="guide-name">Nome da lista</label>
            <input
              id="guide-name" className="guide-input" value={a.name} maxLength={120} autoComplete="off"
              aria-invalid={!!error} onChange={(e) => set({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <Problem text={error} />
            {nav()}
          </>
        )}

        {step === 'tasks' && (
          <TasksStep
            tasks={a.tasks} error={error} setError={setError}
            suggestions={(items.data ?? []).filter((i) => i.active && !a.tasks.some((t) => norm(t) === norm(i.name))).slice(0, MAX_SUGGESTIONS).map((i) => i.name)}
            onChange={(tasks) => set({ tasks })}
          >
            {nav()}
          </TasksStep>
        )}

        {step === 'team' && (
          <TeamStep
            groups={TEAM_GROUPS.map((g) => ({ group: g, names: current(g) }))}
            people={a.people} error={error} setError={setError} onAdd={addPerson} onRemove={removePerson}
          >
            {nav()}
          </TeamStep>
        )}

        {step === 'who' && (
          <>
            <Title step={step}>Quem vai fazer?</Title>
            <p className="guide-text">Toque em uma ou mais funções. Todas as pessoas da função vão receber a lista.</p>
            <div className="guide-options">
              {GROUPS.map((g) => {
                const names = people(g);
                const on = a.roles.includes(g);
                return (
                  <button
                    key={g} type="button" className="guide-option" aria-pressed={on} disabled={names.length === 0}
                    onClick={() => set({ roles: on ? a.roles.filter((r) => r !== g) : [...a.roles, g] })}
                  >
                    <span className="guide-check" aria-hidden="true">{on ? '✓' : ''}</span>
                    <span>
                      <span className="guide-option-title">{g}</span>
                      <span className="guide-option-sub">{names.length ? names.join(', ') : 'Ninguém nesta função'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Problem text={error} />
            {nav()}
          </>
        )}

        {step === 'when' && (
          <>
            <Title step={step}>Em quais dias?</Title>
            <div className="guide-options">
              {([['daily', 'Todos os dias', 'Aparece sozinha todo dia.'], ['weekdays', 'Só em alguns dias', 'Você escolhe os dias da semana.'], ['ondemand', 'Só quando alguém pedir', 'Fica guardada e a equipe abre quando precisar.']] as const).map(([v, label, sub]) => (
                <button key={v} type="button" className="guide-option" aria-pressed={a.when === v} aria-label={label} onClick={() => set({ when: v })}>
                  <span className="guide-check guide-check--round" aria-hidden="true">{a.when === v ? '●' : ''}</span>
                  <span>
                    <span className="guide-option-title">{label}</span>
                    <span className="guide-option-sub">{sub}</span>
                  </span>
                </button>
              ))}
            </div>
            {a.when === 'weekdays' && (
              <>
                <p className="guide-text">Toque nos dias:</p>
                <div className="guide-choices">
                  {DAYS.map(([d, label]) => {
                    const on = a.days.includes(d);
                    return (
                      <button key={d} type="button" className="guide-choice" aria-pressed={on} onClick={() => set({ days: on ? a.days.filter((x) => x !== d) : [...a.days, d] })}>{label}</button>
                    );
                  })}
                </div>
              </>
            )}
            <Problem text={error} />
            {nav()}
          </>
        )}

        {step === 'time' && <TimeStep value={a.dueTime} error={error} onChange={(dueTime) => set({ dueTime })}>{nav()}</TimeStep>}

        {step === 'review' && (
          <>
            <Title step={step}>Está tudo certo?</Title>
            <div className="guide-summary" data-testid="guide-summary">
              <SummaryLine onChange={() => move('name')} label="Mudar o nome">
                A lista <strong>{a.name.trim()}</strong> tem {a.tasks.length} {a.tasks.length === 1 ? 'tarefa' : 'tarefas'}.
              </SummaryLine>
              <ol className="guide-summary-tasks">{a.tasks.map((t) => <li key={t}>{t}</li>)}</ol>
              <SummaryLine onChange={() => move('tasks')} label="Mudar as tarefas" />
              {a.people.length > 0 && (
                <SummaryLine onChange={() => move('team')} label="Mudar a equipe">
                  Pessoas novas na equipe: {a.people.map((p) => `${p.name} (${p.group})`).join(', ')}.
                </SummaryLine>
              )}
              <SummaryLine onChange={() => move('who')} label="Mudar quem faz">
                Quem faz: {a.roles.map((r) => `${r} (${people(r).join(', ')})`).join('; ')}.
              </SummaryLine>
              <SummaryLine onChange={() => move('when')} label="Mudar quando">
                Quando: {whenText(a)}.
              </SummaryLine>
            </div>
            <Problem text={error} />
            {nav(
              <button type="button" className="guide-btn guide-btn--primary" disabled={busy} onClick={create}>
                {busy ? 'Criando…' : 'Criar a lista'}
              </button>,
            )}
          </>
        )}

        {step === 'done' && created && (
          <>
            <div className="guide-done-icon" aria-hidden="true">✓</div>
            <Title step={step}>Pronto! A lista foi criada.</Title>
            <p className="guide-text">
              <strong>{created.name}</strong>: {joinNames(created.assignees.map(firstName))} já{' '}
              {created.assignees.length === 1 ? 'vai' : 'vão'} ver esta lista no celular{a.when === 'ondemand' ? ', para abrir quando precisar' : ' nos dias escolhidos'}.
            </p>
            <p className="guide-text">Se quiser mudar algum detalhe depois, é só ir em Checklists.</p>
            <div className="guide-nav">
              <button type="button" className="guide-btn" onClick={restart}>Criar outra lista</button>
              <button type="button" className="guide-btn guide-btn--primary" onClick={() => go('cls')}>Ver minhas listas</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Título que recebe o foco a cada passo, para o leitor de tela anunciar a nova pergunta. */
function Title({ step, children }: { step: Step; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [step]);
  return <h1 ref={ref} tabIndex={-1} className="guide-title">{children}</h1>;
}

function Problem({ text }: { text: string }) {
  return text ? <div role="alert" className="guide-error">{text}</div> : null;
}

function SummaryLine({ children, onChange, label }: { children?: ReactNode; onChange: () => void; label: string }) {
  return (
    <div className="guide-summary-line">
      {children && <p>{children}</p>}
      <button type="button" className="guide-link" onClick={onChange}>{label}</button>
    </div>
  );
}

type TasksProps = {
  tasks: string[]; suggestions: string[]; error: string; children: ReactNode;
  setError: (m: string) => void; onChange: (t: string[]) => void;
};

function TasksStep({ tasks, suggestions, error, children, setError, onChange }: TasksProps) {
  const [text, setText] = useState('');
  function add(raw: string) {
    const t = raw.trim();
    if (!t) return setError('Escreva a tarefa antes de adicionar.');
    if (tasks.some((x) => norm(x) === norm(t))) return setError('Essa tarefa já está na lista.');
    onChange([...tasks, t]);
    setText('');
  }
  return (
    <>
      <Title step="tasks">O que precisa ser feito?</Title>
      <p className="guide-text">Escreva uma tarefa e toque em “Adicionar”. Repita para cada tarefa.</p>
      <label className="guide-label" htmlFor="guide-task">Nova tarefa</label>
      <div className="guide-row">
        <input
          id="guide-task" className="guide-input" value={text} maxLength={120} autoComplete="off" placeholder="Ex.: Varrer o salão"
          onChange={(e) => { setText(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text); } }}
        />
        <button type="button" className="guide-btn guide-btn--primary" onClick={() => add(text)}>Adicionar</button>
      </div>
      <Problem text={error} />
      {tasks.length > 0 && (
        <ol className="guide-tasks">
          {tasks.map((t) => (
            <li key={t} data-testid="guide-task">
              <span>{t}</span>
              <button type="button" className="guide-link" aria-label={`Tirar ${t}`} onClick={() => onChange(tasks.filter((x) => x !== t))}>Tirar</button>
            </li>
          ))}
        </ol>
      )}
      {suggestions.length > 0 && (
        <>
          <p className="guide-text guide-text--small">Ou toque numa tarefa que já existe:</p>
          <div className="guide-choices">
            {suggestions.map((s) => (
              <button key={s} type="button" className="guide-choice" onClick={() => add(s)}>+ {s}</button>
            ))}
          </div>
        </>
      )}
      {children}
    </>
  );
}

function TimeStep({ value, error, onChange, children }: { value: string; error: string; onChange: (v: string) => void; children: ReactNode }) {
  const [other, setOther] = useState(value !== '' && !TIMES.includes(value));
  return (
    <>
      <Title step="time">Até que horas precisa estar pronto?</Title>
      <p className="guide-text">Depois desse horário, as tarefas que faltarem aparecem como atrasadas.</p>
      <div className="guide-choices">
        {TIMES.map((t) => (
          <button key={t} type="button" className="guide-choice guide-choice--time" aria-pressed={!other && value === t} onClick={() => { setOther(false); onChange(t); }}>{t}</button>
        ))}
        <button type="button" className="guide-choice" aria-pressed={other} onClick={() => { setOther(true); onChange(''); }}>Outro horário</button>
      </div>
      {other && (
        <>
          <label className="guide-label" htmlFor="guide-time">Escolha o horário</label>
          <input id="guide-time" type="time" className="guide-input guide-input--time" value={value} onChange={(e) => onChange(e.target.value)} />
        </>
      )}
      <Problem text={error} />
      {children}
    </>
  );
}

type TeamProps = {
  groups: { group: string; names: string[] }[]; people: NewPerson[]; error: string; children: ReactNode;
  setError: (m: string) => void; onAdd: (p: NewPerson) => string; onRemove: (name: string) => void;
};

function TeamStep({ groups, people, error, children, setError, onAdd, onRemove }: TeamProps) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  function add() {
    if (!name.trim()) return setError('Escreva o nome da pessoa.');
    if (!group) return setError('Escolha a função da pessoa.');
    const problem = onAdd({ name: name.trim(), group });
    if (problem) return setError(problem);
    setName('');
    setGroup('');
  }
  return (
    <>
      <Title step="team">Quem trabalha com você?</Title>
      <p className="guide-text">Esta é a sua equipe hoje. Se alguém novo começou, adicione aqui. Se não, é só tocar em “Próximo”.</p>
      <div className="guide-team">
        {groups.map(({ group: g, names }) => (
          <div key={g} className="guide-team-row" data-testid={`guide-team-${g}`}>
            <span className="guide-team-group">{g}</span>
            <span className="guide-team-names">{names.length ? names.join(', ') : 'Ninguém ainda'}</span>
          </div>
        ))}
      </div>

      {people.length > 0 && (
        <ul className="guide-tasks guide-people">
          {people.map((p) => (
            <li key={p.name} data-testid="guide-new-person">
              <span>{p.name} · {p.group}</span>
              <span className="guide-tag">nova</span>
              <button type="button" className="guide-link" aria-label={`Tirar ${p.name}`} onClick={() => onRemove(p.name)}>Tirar</button>
            </li>
          ))}
        </ul>
      )}

      <div className="guide-add">
        <div className="guide-add-title">Adicionar uma pessoa</div>
        <label className="guide-label" htmlFor="guide-person">Nome da pessoa</label>
        <input
          id="guide-person" className="guide-input" value={name} maxLength={80} autoComplete="off" placeholder="Ex.: Pedro Ramos"
          onChange={(e) => { setName(e.target.value); setError(''); }}
        />
        <div className="guide-label" id="guide-person-group">Função</div>
        <div className="guide-choices" role="group" aria-labelledby="guide-person-group">
          {groups.map(({ group: g }) => (
            <button key={g} type="button" className="guide-choice" aria-pressed={group === g} onClick={() => { setGroup(g); setError(''); }}>{g}</button>
          ))}
        </div>
        <Problem text={error} />
        <div>
          <button type="button" className="guide-btn guide-btn--primary" onClick={add}>Adicionar à equipe</button>
        </div>
        <p className="guide-text guide-text--small">Para cadastrar outro gestor, use a página Equipe: gestores precisam de um PIN.</p>
      </div>
      {children}
    </>
  );
}
