import { CATEGORIES } from '@rastro/domain';
import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useResource } from '../api/useResource';
import { ChipGroup } from '../ui/ChipGroup';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';
import { toneOf } from '../ui/categories';
import type { AdminItem } from './types';

type Draft = Omit<AdminItem, 'usedIn' | 'id'> & { id?: string };
const EMPTY: Draft = { name: '', description: '', category: 'Limpeza', required: false, allowNote: false, active: true };
const COLS = 'minmax(240px,3fr) 120px 100px 100px 150px 90px 60px';

export function ItemsPage() {
  const toast = useToast();
  const { data, error, setData } = useResource<AdminItem[]>('/api/admin/items');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [draft, setDraft] = useState<Draft | null>(null);

  const replace = (it: AdminItem) => setData((list) => (list ?? []).some((x) => x.id === it.id) ? list!.map((x) => (x.id === it.id ? it : x)) : [...(list ?? []), it]);

  async function toggle(it: AdminItem) {
    try {
      replace(await api.patch<AdminItem>(`/api/admin/items/${it.id}`, { active: !it.active }));
      toast(it.active ? 'Item desativado. Ele deixa de aparecer nos checklists a partir de hoje.' : 'Item reativado.', it.active ? 'warn' : 'ok');
    } catch (e) {
      toast(errorMessage(e), 'warn');
    }
  }

  const query = q.trim().toLowerCase();
  const rows = (data ?? []).filter((i) => (cat === 'all' || i.category === cat) && (!query || i.name.toLowerCase().includes(query)));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Biblioteca</div>
          <h1 className="page-title">Itens de checklist</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDraft(EMPTY)}>+ Novo item</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input className="input" style={{ flex: '1 1 220px', maxWidth: 320, fontSize: 14, padding: '9px 12px' }} placeholder="Buscar item…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ChipGroup size="md" options={['all', ...CATEGORIES]} labels={{ all: 'Todas' }} value={cat} onToggle={setCat} />
      </div>
      {error && <div className="banner banner--error">{error}</div>}
      <div className="table-wrap">
        <div style={{ minWidth: 760 }}>
          <div className="table-row table-head" style={{ gridTemplateColumns: COLS }}>
            <span>Item</span><span>Categoria</span><span>Obrigatório</span><span>Observação</span><span>Usado em</span><span>Status</span><span />
          </div>
          {rows.map((i) => (
            <div key={i.id} className="table-row" style={{ gridTemplateColumns: COLS }}>
              <div style={{ minWidth: 0, opacity: i.active ? 1 : 0.5 }}>
                <div style={{ font: '600 14px var(--font-ui)' }}>{i.name}</div>
                <div className="truncate muted-sm">{i.description || 'Sem descrição'}</div>
              </div>
              <span className="chip" style={{ justifySelf: 'start', color: toneOf(i.category), background: 'var(--bg)' }}>{i.category}</span>
              <span className="cell">{i.required ? 'Sim' : '—'}</span>
              <span className="cell">{i.allowNote ? 'Permite' : '—'}</span>
              <span className="muted-sm" title={i.usedIn.join(', ')}>
                {i.usedIn.length ? `${i.usedIn.length} ${i.usedIn.length > 1 ? 'checklists' : 'checklist'}` : 'Não utilizado'}
              </span>
              <Switch checked={i.active} onChange={() => toggle(i)} label={i.active ? 'Ativo' : 'Inativo'} ariaLabel={`Ativo: ${i.name}`} />
              <button type="button" className="text-btn" style={{ fontSize: 12 }} onClick={() => setDraft(i)}>Editar</button>
            </div>
          ))}
          {data && rows.length === 0 && <div className="table-empty">Nenhum item encontrado.</div>}
        </div>
      </div>
      {draft && <ItemModal draft={draft} onClose={() => setDraft(null)} onSaved={(it, created) => {
        replace(it);
        setDraft(null);
        toast(created ? 'Item cadastrado. Já pode ser usado em qualquer checklist.' : 'Item atualizado.');
      }} />}
    </div>
  );
}

type ModalProps = { draft: Draft; onClose: () => void; onSaved: (it: AdminItem, created: boolean) => void };

function ItemModal({ draft, onClose, onSaved }: ModalProps) {
  const [d, setD] = useState(draft);
  const [err, setErr] = useState('');
  const upd = (p: Partial<Draft>) => {
    setD((x) => ({ ...x, ...p }));
    setErr('');
  };

  async function save() {
    if (!d.name.trim()) return setErr('Informe o nome do item.');
    const body = { name: d.name.trim(), description: d.description, category: d.category, required: d.required, allowNote: d.allowNote, active: d.active };
    try {
      if (d.id) onSaved(await api.patch<AdminItem>(`/api/admin/items/${d.id}`, body), false);
      else onSaved(await api.post<AdminItem>('/api/admin/items', body), true);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  const toggles: [keyof Draft & ('required' | 'allowNote' | 'active'), string, string][] = [
    ['required', 'Obrigatório', 'O checklist só pode ser concluído com este item feito.'],
    ['allowNote', 'Permitir observação', 'O funcionário pode escrever um comentário.'],
    ['active', 'Ativo', 'Itens inativos não aparecem para a equipe.'],
  ];

  return (
    <Modal title={d.id ? 'Editar item' : 'Novo item'} onClose={onClose}>
      <div className="field">
        <label htmlFor="item-name">Nome do item *</label>
        <input id="item-name" value={d.name} aria-invalid={!!err} placeholder="Ex.: Conferir estoque de carvão" onChange={(e) => upd({ name: e.target.value })} />
        {err && <span className="field-error">{err}</span>}
      </div>
      <label className="field">
        Descrição
        <textarea rows={2} value={d.description} placeholder="Orientação curta para quem executa" onChange={(e) => upd({ description: e.target.value })} />
      </label>
      <div className="field">
        Categoria
        <ChipGroup options={CATEGORIES} value={d.category as (typeof CATEGORIES)[number]} onToggle={(c) => upd({ category: c })} />
      </div>
      <div>
        {toggles.map(([k, label, hint]) => (
          <div key={k} className="toggle-row">
            <div>
              <div className="toggle-row-label">{label}</div>
              <div className="toggle-row-hint">{hint}</div>
            </div>
            <Switch large checked={d[k]} ariaLabel={label} onChange={() => upd({ [k]: !d[k] })} />
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={save}>Salvar item</button>
      </div>
    </Modal>
  );
}
