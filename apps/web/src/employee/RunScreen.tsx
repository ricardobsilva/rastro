import type { Employee } from '../types';
import { Avatar } from '../ui/Avatar';
import { barColor, pct } from '../ui/status';
import { ExecItemCard } from './ExecItemCard';
import { NoteEditor } from './NoteEditor';
import type { Execution } from './types';
import { useExecution } from './useExecution';

type Props = { executionId: number; me: Employee; onBack: () => void; onSwitch: () => void; onFinished: () => void };

export const runMeta = (e: Execution) =>
  e.dueTime ? `Concluir até ${e.dueTime}${e.status === 'late' ? ' · com atraso' : ''}` : 'Sob demanda';

export function RunScreen({ executionId, me, onBack, onSwitch, onFinished }: Props) {
  const { exec, error, toggle, saveNote, finish, finishError, allDone, pop } = useExecution(executionId);

  return (
    <div className="run">
      <div className="run-head">
        <div className="run-head-top">
          <button type="button" className="link-btn" onClick={onBack}>← Meu dia</button>
          <button type="button" className="me-pill" onClick={onSwitch}>
            <Avatar initials={me.initials} color={me.color} size={24} />
            {me.firstName} · Trocar
          </button>
        </div>
        {exec && (
          <>
            <div className="run-head-title">
              <div style={{ minWidth: 0 }}>
                <div className="eyebrow eyebrow--sm">Checklist</div>
                <h1 className="run-title">{exec.name}</h1>
                <div className="run-meta">{runMeta(exec)}</div>
              </div>
              <div className="run-count">{exec.done}/{exec.total}</div>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${pct(exec.done, exec.total)}%`, background: barColor(exec.status) }} />
            </div>
          </>
        )}
      </div>
      <div className="run-body">
        {error && <div className="banner banner--error">{error}</div>}
        {allDone && (
          <div className="banner banner--success">
            <div className="banner-icon">✓</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Checklist concluído</div>
              <div style={{ fontSize: 13 }}>Tudo registrado em seu nome. Bom trabalho!</div>
            </div>
          </div>
        )}
        {finishError && <div className="banner banner--error">{finishError}</div>}
        {exec?.items.map((it) => (
          <ExecItemCard key={it.itemId} item={it} me={me} pop={pop === it.itemId} onToggle={() => toggle(it.itemId, it.status !== 'done')}>
            <NoteEditor item={it} onSave={(note) => saveNote(it.itemId, note)} />
          </ExecItemCard>
        ))}
      </div>
      {exec && (
        <div className="run-foot">
          <button type="button" className="btn-block" onClick={async () => (await finish()) && onFinished()}>
            {allDone ? 'Voltar para Meu dia' : 'Concluir checklist'}
          </button>
        </div>
      )}
    </div>
  );
}
