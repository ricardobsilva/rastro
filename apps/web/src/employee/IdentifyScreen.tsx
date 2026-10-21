import { RESTAURANT } from '../restaurant';
import type { Employee } from '../types';
import { Avatar } from '../ui/Avatar';

type Props = { employees: Employee[]; onPick: (e: Employee) => void };

export function IdentifyScreen({ employees, onPick }: Props) {
  return (
    <div className="identify">
      <div className="restaurant">
        <div className="restaurant-logo">{RESTAURANT.initials}</div>
        <div>
          <div className="restaurant-name">{RESTAURANT.name}</div>
          <div className="restaurant-tagline">{RESTAURANT.tagline}</div>
        </div>
      </div>
      <div className="identify-head">
        <h1 className="title-xl">Quem está trabalhando agora?</h1>
        <p className="muted">Toque no seu nome para começar. O aparelho lembra de você até alguém trocar de usuário.</p>
      </div>
      <div className="brand-sign">
        com <span>Rastro</span>
      </div>
      {employees.length === 0 ? (
        <div className="empty">Nenhum funcionário ativo. Fale com o gestor.</div>
      ) : (
        <div className="emp-grid">
          {employees.map((e) => (
            <button key={e.id} type="button" className="emp-card" onClick={() => onPick(e)}>
              <Avatar initials={e.initials} color={e.color} />
              <span>
                <span className="emp-card-name">{e.shortName}</span>
                <span className="emp-card-role">{e.role}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
