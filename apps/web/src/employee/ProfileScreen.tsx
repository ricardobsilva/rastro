import type { Employee } from '../types';
import { Avatar } from '../ui/Avatar';

type Props = { me: Employee; since: string | null; onSwitch: () => void; onLogout: () => void };

export function ProfileScreen({ me, since, onSwitch, onLogout }: Props) {
  return (
    <div className="screen profile">
      <div className="profile-head">
        <Avatar initials={me.initials} color={me.color} size={60} />
        <div>
          <h1 className="profile-name">{me.name}</h1>
          <div className="muted" style={{ fontSize: 14 }}>{me.role} · {me.group}</div>
        </div>
      </div>
      <div className="session-box">
        <div className="session-box-title"><span className="dot-ok" />Sessão ativa neste aparelho</div>
        <div className="session-box-text">
          {since && `Identificado desde as ${since}. `}Todas as marcações são registradas em seu nome, com horário.
        </div>
      </div>
      <button type="button" className="btn btn-primary btn-lg" onClick={onSwitch}>Trocar usuário</button>
      <button type="button" className="btn-danger-link" onClick={onLogout}>Sair deste aparelho</button>
      <div className="profile-hint">Use “Trocar usuário” ao entregar o aparelho para um colega. Assim cada tarefa fica com o responsável certo.</div>
    </div>
  );
}
