import { RESTAURANT } from '../restaurant';
import type { Employee } from '../types';
import { Avatar } from '../ui/Avatar';

type Props = { me: Employee; onContinue: () => void; onSwitch: () => void };

export function ResumeScreen({ me, onContinue, onSwitch }: Props) {
  return (
    <div className="resume">
      <div className="resume-brand">
        <div className="restaurant-logo restaurant-logo--sm">{RESTAURANT.initials}</div>
        <span>{RESTAURANT.name}</span>
      </div>
      <div className="resume-center">
        <div className="resume-eyebrow">Sessão ativa neste aparelho</div>
        <Avatar initials={me.initials} color={me.color} size={92} style={{ border: '4px solid var(--bg)' }} />
        <h1 className="resume-title">Bem-vindo de volta, {me.firstName}</h1>
        <p className="resume-text">Sem login. Sua identificação fica salva aqui até alguém tocar em “Trocar usuário”.</p>
      </div>
      <div className="resume-actions">
        <button type="button" className="resume-continue" onClick={onContinue}>
          Continuar como {me.firstName}
        </button>
        <button type="button" className="resume-switch" onClick={onSwitch}>
          Não é o {me.firstName}? Trocar usuário
        </button>
      </div>
    </div>
  );
}
