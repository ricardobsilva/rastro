import { useResource } from '../api/useResource';
import type { Employee } from '../types';
import { Avatar } from '../ui/Avatar';
import { ProgressRing } from '../ui/ProgressRing';
import { plural } from '../ui/status';
import { ChecklistCard } from './ChecklistCard';
import { OnDemandList } from './OnDemandList';
import type { Today } from './types';

type Props = { me: Employee; onOpen: (executionId: number) => void; onSwitch: () => void };

export function TodayScreen({ me, onOpen, onSwitch }: Props) {
  const { data, error, reload } = useResource<Today>('/api/me/today', { pollMs: 30_000 });

  if (error && !data)
    return (
      <div className="screen">
        <div className="empty">
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={reload}>Tentar de novo</button>
        </div>
      </div>
    );
  if (!data) return <div className="screen" aria-busy="true" />;

  const { summary: s } = data;
  return (
    <div className="screen">
      <div className="today-head">
        <div className="today-head-text">
          <div className="eyebrow">{data.dateLabel}</div>
          <h1 className="title-hero">{data.greeting}, {me.firstName}!</h1>
          <div className="muted">Você possui {plural(s.total, 'atividade', 'atividades')} para hoje.</div>
        </div>
        <button type="button" className="switch-avatar" onClick={onSwitch}>
          <Avatar initials={me.initials} color={me.color} size={44} ring />
          <span>Trocar ⇄</span>
        </button>
      </div>

      <div className="progress-card">
        <ProgressRing value={s.total ? s.done / s.total : 0} />
        <div className="progress-card-body">
          <div className="progress-card-title">{s.done} de {s.total} tarefas concluídas</div>
          <div className="progress-card-chips">
            <span className="chip chip--dark">{s.done} concluídas</span>
            <span className="chip chip--dark">{s.pending} pendentes</span>
            {s.late > 0 && <span className="chip chip--accent">{s.late} atrasadas</span>}
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="section-label">Seus checklists de hoje</div>
        {data.cards.map((c) => (
          <ChecklistCard key={c.executionId} card={c} onOpen={() => onOpen(c.executionId)} />
        ))}
        {data.cards.length === 0 && (
          <div className="empty">
            <div className="empty-title">Nada para hoje</div>
            Nenhum checklist foi atribuído a você. Fale com o gerente se isso parecer errado.
          </div>
        )}
      </div>

      {data.onDemand.length > 0 && (
        <div className="stack">
          <div className="section-label">Quando necessário</div>
          <OnDemandList list={data.onDemand} onStarted={onOpen} />
        </div>
      )}
    </div>
  );
}
