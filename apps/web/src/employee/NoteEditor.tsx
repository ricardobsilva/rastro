import { useState } from 'react';
import type { ExecItem } from './types';

type Props = { item: ExecItem; onSave: (note: string) => Promise<boolean> };

/** "+ Adicionar/Editar observação" com textarea, só para itens que permitem. */
export function NoteEditor({ item, onSave }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!item.allowNote) return null;

  if (draft === null)
    return (
      <button type="button" className="note-btn" onClick={() => setDraft(item.note)}>
        + {item.note ? 'Editar observação' : 'Adicionar observação'}
      </button>
    );

  return (
    <div className="note-form">
      <textarea
        rows={3}
        value={draft}
        maxLength={500}
        autoFocus
        aria-label={`Observação sobre ${item.name}`}
        placeholder="Ex.: faltaram 2 toalhas, avisei a gerência"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-sm btn-primary" onClick={async () => (await onSave(draft)) && setDraft(null)}>
          Salvar observação
        </button>
        <button type="button" className="btn-sm btn-secondary" onClick={() => setDraft(null)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
