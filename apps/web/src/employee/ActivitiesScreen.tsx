import { useResource } from '../api/useResource';
import { ACTION } from '../ui/actions';
import type { Activity } from './types';

export function ActivitiesScreen() {
  const { data, error } = useResource<Activity[]>('/api/me/activities');
  return (
    <div className="screen" style={{ gap: 16 }}>
      <div>
        <h1 className="title-xl">Minhas atividades</h1>
        <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Tudo que você registrou hoje, com horário.</div>
      </div>
      {error && <div className="banner banner--error">{error}</div>}
      {data && data.length > 0 && <ActivityList list={data} />}
      {data?.length === 0 && <div className="empty">Você ainda não concluiu tarefas hoje.</div>}
    </div>
  );
}

export function ActivityList({ list, compact }: { list: Activity[]; compact?: boolean }) {
  return (
    <ul className={`activity-list${compact ? ' activity-list--compact' : ''}`}>
      {list.map((a) => (
        <li key={a.id} className="activity">
          <span className="activity-time">{a.time}</span>
          <span className="activity-body">
            <span className="activity-item">{a.itemName}</span>
            {!compact && <span className="activity-cl">{a.checklistName}</span>}
          </span>
          <span className="chip activity-chip" style={{ color: ACTION[a.action].fg, background: ACTION[a.action].bg }}>
            {ACTION[a.action].label}
          </span>
        </li>
      ))}
    </ul>
  );
}
