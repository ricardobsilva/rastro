import { GROUPS, WEEKDAYS_SHORT, assigneesOf, firstName } from '@rastro/domain';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useResource } from '../api/useResource';
import { ChipGroup } from '../ui/ChipGroup';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';
import { toneOf } from '../ui/categories';
import { plural } from '../ui/status';
import { useAdmin } from './context';
import { periodLabel } from './periodLabel';
import type { AdminChecklist, AdminEmployee, AdminItem, Period } from './types';

type Draft = Omit<AdminChecklist, 'id' | 'assignees'> & { id?: string };

const PERIODS: [Period, string][] = [['daily', 'Diariamente'], ['weekdays', 'Dias específicos'], ['weekly', 'Semanalmente'], ['ondemand', 'Sob demanda']];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const NEW: Draft = { name: '', description: '', period: 'daily', days: [], dueTime: '12:00', roles: [], employeeIds: [], itemIds: [], active: true };

const toDraft = (c: AdminChecklist): Draft => ({ ...c, dueTime: c.dueTime ?? '12:00' });

export function ChecklistsPage() {
  const toast = useToast();
  const { go } = useAdmin();
  const cls = useResource<AdminChecklist[]>('/api/admin/checklists');
  const items = useResource<AdminItem[]>('/api/admin/items');
  const emps = useResource<AdminEmployee[]>('/api/admin/employees');
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (cls.data && !draft && selId === null && cls.data[0]) {
      setSelId(cls.data[0].id);
      setDraft(toDraft(cls.data[0]));
    }
  }, [cls.data, draft, selId]);

  const select = (c: AdminChecklist) => {
    setSelId(c.id);
    setDraft(toDraft(c));
    setErr('');
  };
  const upd = (p: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setErr('');
  };

  async function save() {
    if (!draft) return;
    const { id, ...body } = draft;
    try {
      const saved = id ? await api.put<AdminChecklist>(`/api/admin/checklists/${id}`, body) : await api.post<AdminChecklist>('/api/admin/checklists', body);
      cls.setData((list) => (list?.some((c) => c.id === saved.id) ? list.map((c) => (c.id === saved.id ? saved : c)) : [...(list ?? []), saved]));
      setSelId(saved.id);
      setDraft(toDraft(saved));
      toast(id ? 'Checklist atualizado. O histórico anterior foi preservado.' : 'Checklist criado e atribuído à equipe.');
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  function discard() {
    const c = cls.data?.find((x) => x.id === selId);
    setDraft(c ? toDraft(c) : null);
    setErr('');
  }

  const activeEmps = (emps.data ?? []).filter((e) => e.active);
  const empName = new Map((emps.data ?? []).map((e) => [e.id, e.name]));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Configuração</div>
          <h1 className="page-title">Checklists</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => go('guide')}>Criar com ajuda</button>
          <button type="button" className="btn btn-primary" onClick={() => { setSelId(null); setDraft(NEW); setErr(''); }}>+ Criar checklist</button>
        </div>
      </div>
      {cls.error && <div className="banner banner--error">{cls.error}</div>}
      <div className="cl-layout">
        <ul className="cl-list" aria-label="Checklists">
          {cls.data?.map((c) => (
            <li key={c.id}>
              <button type="button" className={`cl-list-card${c.id === selId ? ' is-selected' : ''}`} style={{ opacity: c.active ? 1 : 0.6 }} onClick={() => select(c)}>
                <div className="cl-list-top">
                  <span style={{ font: '600 15px var(--font-ui)' }}>{c.name}</span>
                  <span style={{ font: '600 11px var(--font-ui)', color: c.active ? 'var(--success)' : 'var(--text-2)' }}>{c.active ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div className="muted-sm">
                  {periodLabel(c)}{c.dueTime && c.period !== 'ondemand' ? ` · até ${c.dueTime}` : ''} · {plural(c.itemIds.length, 'item', 'itens')}
                </div>
                <div className="muted-sm">{c.assignees.length ? c.assignees.map(firstName).join(', ') : 'Sem responsáveis'}</div>
              </button>
            </li>
          ))}
        </ul>

        {draft && (
          <div className="panel cl-editor">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, font: '700 20px var(--font-display)' }}>{draft.id ? 'Editar checklist' : 'Novo checklist'}</h2>
              <Switch large checked={draft.active} label={draft.active ? 'Ativo' : 'Inativo'} ariaLabel="Checklist ativo" onChange={() => upd({ active: !draft.active })} />
            </div>
            {err && <div className="banner banner--error" style={{ fontSize: 13 }}>{err}</div>}
            <div className="cl-fields">
              <label className="field">
                Nome do checklist
                <input value={draft.name} aria-invalid={!!err && !draft.name.trim()} placeholder="Ex.: Abertura do bar" onChange={(e) => upd({ name: e.target.value })} />
              </label>
              <label className="field">
                Descrição
                <input value={draft.description} placeholder="Opcional" onChange={(e) => upd({ description: e.target.value })} />
              </label>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <div className="field-label">Periodicidade</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PERIODS.map(([v, l]) => (
                  <button key={v} type="button" className="chip-btn chip-btn--square" aria-pressed={draft.period === v}
                    onClick={() => upd({ period: v, days: v === 'weekly' ? draft.days.slice(0, 1) : draft.days })}>
                    {l}
                  </button>
                ))}
              </div>
              {(draft.period === 'weekdays' || draft.period === 'weekly') && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {DAY_ORDER.map((d) => (
                    <button key={d} type="button" className="chip-btn chip-btn--sm chip-btn--day" aria-pressed={draft.days.includes(d)}
                      onClick={() => upd({ days: draft.period === 'weekly' ? [d] : draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d] })}>
                      {WEEKDAYS_SHORT[d]}
                    </button>
                  ))}
                  <span className="muted-sm">{draft.period === 'weekly' ? 'Escolha um dia' : 'Escolha um ou mais dias'}</span>
                </div>
              )}
              {draft.period !== 'ondemand' && (
                <div className="due-row">
                  <label htmlFor="cl-due">Concluir até</label>
                  <input id="cl-due" type="time" className="input mono" value={draft.dueTime ?? ''} onChange={(e) => upd({ dueTime: e.target.value })} />
                  <span className="muted-sm" style={{ fontSize: 13 }}>Após esse horário, itens pendentes aparecem como atrasados.</span>
                </div>
              )}
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <div className="field-label">Responsáveis</div>
              <div className="who-row">
                <span className="who-label">Funções</span>
                <ChipGroup options={GROUPS} value={draft.roles as (typeof GROUPS)[number][]}
                  onToggle={(g) => upd({ roles: draft.roles.includes(g) ? draft.roles.filter((x) => x !== g) : [...draft.roles, g] })} />
              </div>
              <div className="who-row">
                <span className="who-label">Pessoas</span>
                <ChipGroup options={activeEmps.map((e) => e.id)} labels={Object.fromEntries(activeEmps.map((e) => [e.id, e.firstName]))} value={draft.employeeIds}
                  onToggle={(id) => upd({ employeeIds: draft.employeeIds.includes(id) ? draft.employeeIds.filter((x) => x !== id) : [...draft.employeeIds, id] })} />
              </div>
              <ResolvedAssignees draft={draft} employees={emps.data ?? []} names={empName} />
            </div>

            <ItemsEditor draft={draft} items={items.data ?? []} onChange={(itemIds) => upd({ itemIds })} />

            <div className="cl-actions">
              <button type="button" className="btn btn-primary" onClick={save}>Salvar checklist</button>
              <button type="button" className="btn btn-secondary" onClick={discard}>Descartar alterações</button>
              <span className="muted-sm" style={{ flex: '1 1 220px' }}>As alterações valem a partir de hoje. Registros de dias anteriores não são modificados.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResolvedAssignees({ draft, employees, names }: { draft: Draft; employees: AdminEmployee[]; names: Map<string, string> }) {
  const res = assigneesOf(draft, employees);
  return (
    <div className="muted" style={{ fontSize: 13 }}>
      {res.length ? `Aparecerá no “Meu dia” de: ${res.map((e) => names.get(e.id)).join(', ')}.` : 'Ninguém receberá este checklist ainda.'}
    </div>
  );
}

function ItemsEditor({ draft, items, onChange }: { draft: Draft; items: AdminItem[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));
  const ids = draft.itemIds;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    onChange(next);
  };
  const query = q.trim().toLowerCase();
  const library = items.filter((i) => i.active && !ids.includes(i.id) && (!query || i.name.toLowerCase().includes(query)));

  return (
    <div className="cl-items">
      <div className="stack" style={{ gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 13px var(--font-ui)' }}>
          <span>Itens do checklist ({ids.length})</span>
          <span className="muted-sm" style={{ fontSize: 13 }}>Arraste para reordenar</span>
        </div>
        {ids.map((id, idx) => {
          const it = byId.get(id);
          return (
            <div
              key={id}
              data-testid="cl-item-row"
              draggable
              className={`cl-item-row${over === idx && drag !== null && drag !== idx ? ' is-over' : ''}`}
              style={{ opacity: drag === idx ? 0.4 : 1 }}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* alguns navegadores bloqueiam */ }
                setDrag(idx);
              }}
              onDragOver={(e) => { e.preventDefault(); setOver(idx); }}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, idx); setDrag(null); setOver(null); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
            >
              <span className="cl-grip" aria-hidden="true">⋮⋮</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)', width: 18 }}>{idx + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div data-testid="cl-item-name" style={{ font: '600 13px var(--font-ui)' }}>{it?.name ?? '?'}</div>
                <div style={{ font: '500 11px var(--font-ui)', color: toneOf(it?.category ?? '') }}>{it?.category}{it?.required ? ' · Obrigatório' : ''}</div>
              </div>
              <button type="button" className="icon-btn" aria-label="Subir" onClick={() => move(idx, idx - 1)}>↑</button>
              <button type="button" className="icon-btn" aria-label="Descer" onClick={() => move(idx, idx + 1)}>↓</button>
              <button type="button" className="icon-btn icon-btn--danger" aria-label="Remover" onClick={() => onChange(ids.filter((_, j) => j !== idx))}>×</button>
            </div>
          );
        })}
        {ids.length === 0 && <div className="empty" style={{ padding: 24, borderRadius: 12, fontSize: 13 }}>Adicione itens da biblioteca ao lado.</div>}
      </div>
      <section className="cl-library" aria-label="Adicionar da biblioteca">
        <div style={{ font: '600 13px var(--font-ui)' }}>Adicionar da biblioteca</div>
        <input className="input" placeholder="Buscar item…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="cl-library-list">
          {library.map((i) => (
            <button key={i.id} type="button" className="cl-library-item" onClick={() => onChange([...ids, i.id])}>
              <span style={{ font: '700 14px var(--font-ui)', color: 'var(--primary)' }}>+</span>
              <span style={{ flex: 1, minWidth: 0, font: '500 13px var(--font-ui)' }}>{i.name}</span>
              <span style={{ font: '500 11px var(--font-ui)', color: toneOf(i.category) }}>{i.category}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
