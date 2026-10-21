import { STATUS, barColor, pct, plural } from '../ui/status';
import type { TodayCard } from './types';

type Props = { card: TodayCard; onOpen: () => void; selected?: boolean; compact?: boolean };

export function ChecklistCard({ card, onOpen, selected, compact }: Props) {
  const st = STATUS[card.status];
  return (
    <button type="button" className={`cl-card${compact ? ' cl-card--compact' : ''}${selected ? ' is-selected' : ''}`} onClick={onOpen}>
      <div className="cl-card-top">
        <div style={{ minWidth: 0 }}>
          <div className="cl-card-name">{card.name}</div>
          <div className="cl-card-meta">
            {card.dueTime ? `Até ${card.dueTime}` : 'Sob demanda'} · {plural(card.total, 'item', 'itens')}
          </div>
        </div>
        <span className="chip" style={{ color: st.fg, background: st.bg }}>{st.label}</span>
      </div>
      <div className="cl-card-bar">
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct(card.done, card.total)}%`, background: barColor(card.status) }} />
        </div>
        <span className="mono">{card.done}/{card.total}</span>
      </div>
    </button>
  );
}
