import type { Employee } from '../types';
import { Avatar } from '../ui/Avatar';

type Props = { employees: Employee[]; currentId: string | null; onPick: (e: Employee) => void; onClose: () => void };

export function SwitchSheet({ employees, currentId, onPick, onClose }: Props) {
  return (
    <div className="sheet-overlay" data-testid="sheet-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="switch-title" className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div>
          <div id="switch-title" className="sheet-title">Quem vai usar agora?</div>
          <div className="sheet-sub">Toque no nome. As próximas marcações ficam com essa pessoa.</div>
        </div>
        <div className="sheet-grid">
          {employees.map((e) => {
            const cur = e.id === currentId;
            return (
              <button key={e.id} type="button" className={`sheet-emp${cur ? ' is-current' : ''}`} onClick={() => (cur ? onClose() : onPick(e))}>
                <Avatar initials={e.initials} color={e.color} size={36} />
                <span style={{ minWidth: 0 }}>
                  <span className="sheet-emp-name">{e.shortName}</span>
                  <span className="sheet-emp-role">{cur ? 'Usando agora' : e.role}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
