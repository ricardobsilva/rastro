import type { Employee } from '../types';
import { Avatar } from '../ui/Avatar';
import type { ExecItem } from './types';

type Props = { item: ExecItem; me: Employee; pop: boolean; onToggle: () => void; large?: boolean; children?: React.ReactNode };

export function ExecItemCard({ item, me, pop, onToggle, large, children }: Props) {
  const done = item.status === 'done';
  const late = item.status === 'late';
  return (
    <div className={`exec-item${done ? ' is-done' : ''}${late ? ' is-late' : ''}${large ? ' exec-item--lg' : ''}`}>
      <div className="exec-item-row">
        <button
          type="button"
          className={`check${pop ? ' is-pop' : ''}`}
          aria-label={`${done ? 'Desmarcar' : 'Marcar'} ${item.name}`}
          aria-pressed={done}
          onClick={onToggle}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3.5 9.5l3.5 3.5 7.5-8" fill="none" stroke="#FFFDF9" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="exec-item-body">
          <div className="exec-item-name">{item.name}</div>
          {item.description && <div className="exec-item-desc">{item.description}</div>}
          <div className="exec-item-chips">
            {done && item.doneAt && (
              <span className="chip chip--done">
                <Avatar initials={me.initials} color={me.color} size={18} />
                {me.firstName} · {item.doneAt}
              </span>
            )}
            {late && <span className="chip chip--late">Atrasado</span>}
            {item.required && <span className="chip chip--neutral">Obrigatório</span>}
            {!done && item.undoneAt && <span className="chip chip--warn">Desmarcado às {item.undoneAt} · registrado no histórico</span>}
          </div>
          {item.note && <div className="exec-item-note">“{item.note}”</div>}
        </div>
      </div>
      {children}
    </div>
  );
}
