import { useEffect, useState } from 'react';
import { ApiError, api, errorMessage } from '../api/client';
import { useResource } from '../api/useResource';
import { ACTION } from '../ui/actions';
import { Avatar } from '../ui/Avatar';
import type { AdminEmployee, HistoryPageData } from './types';
import { useDates } from './useDates';

const COLS = '90px 60px 1.3fr 1.6fr 1.2fr 110px 1.4fr';

export function HistoryPage() {
  const dates = useDates();
  const emps = useResource<AdminEmployee[]>('/api/admin/employees');
  const [f, setF] = useState({ q: '', date: 'all', employeeId: 'all', action: 'all' });
  const [data, setData] = useState<HistoryPageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = (offset: number) => {
    const qs = new URLSearchParams();
    if (f.date !== 'all') qs.set('date', f.date);
    if (f.employeeId !== 'all') qs.set('employeeId', f.employeeId);
    if (f.action !== 'all') qs.set('action', f.action);
    if (f.q.trim()) qs.set('q', f.q.trim());
    if (offset) qs.set('offset', String(offset));
    const s = qs.toString();
    return `/api/admin/history${s ? `?${s}` : ''}`;
  };

  async function load(offset: number) {
    try {
      const page = await api.get<HistoryPageData>(query(offset));
      setData((prev) => (offset && prev ? { ...page, rows: [...prev.rows, ...page.rows] } : page));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return window.location.reload();
      setError(errorMessage(e));
    }
  }

  useEffect(() => {
    load(0); // filtros mudaram: recomeça da primeira página
  }, [f.q, f.date, f.employeeId, f.action]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="page">
      <div>
        <div className="eyebrow">Auditoria</div>
        <h1 className="page-title">Histórico de execução</h1>
        <div className="muted" style={{ fontSize: 14, marginTop: 6, maxWidth: 680 }}>
          Cada registro guarda o nome do checklist e do item no momento da execução. Desmarcações nunca apagam o registro original.
        </div>
      </div>
      <div className="filters">
        <input className="input" style={{ flex: '1 1 200px', maxWidth: 280 }} placeholder="Buscar item ou checklist…" value={f.q} onChange={set('q')} />
        <select className="select" aria-label="Data" value={f.date} onChange={set('date')}>
          <option value="all">Todas as datas</option>
          {dates.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="select" aria-label="Funcionário" value={f.employeeId} onChange={set('employeeId')}>
          <option value="all">Todos os funcionários</option>
          {emps.data?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="select" aria-label="Ação" value={f.action} onChange={set('action')}>
          <option value="all">Todas as ações</option>
          <option value="done">Concluído</option>
          <option value="undone">Desmarcado</option>
          <option value="note">Observação</option>
        </select>
        {data && <span className="muted" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500 }}>{data.total} registros · {data.undone} desmarcações</span>}
      </div>
      {error && <div className="banner banner--error">{error}</div>}
      <div className="table-wrap">
        <div style={{ minWidth: 860 }}>
          <div className="table-row table-head" style={{ gridTemplateColumns: COLS }}>
            <span>Data</span><span>Hora</span><span>Checklist</span><span>Item</span><span>Responsável</span><span>Status</span><span>Observação</span>
          </div>
          {data?.rows.map((r) => (
            <div key={r.id} className={`table-row${r.action === 'undone' ? ' is-undone' : ''}`} style={{ gridTemplateColumns: COLS, padding: '10px 16px' }}>
              <span className="cell">{r.dateLabel}</span>
              <span className="mono">{r.time}</span>
              <span style={{ font: '400 13px var(--font-ui)', color: 'var(--text-3)' }}>{r.checklistName}</span>
              <span style={{ font: '600 13px var(--font-ui)' }}>{r.itemName}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px var(--font-ui)' }}>
                <Avatar initials={r.initials} color={r.color} size={24} />{r.employeeName}
              </span>
              <span className="chip" style={{ justifySelf: 'start', color: ACTION[r.action].fg, background: ACTION[r.action].bg }}>{ACTION[r.action].label}</span>
              <span className="muted-sm">{r.note || '—'}</span>
            </div>
          ))}
          {data?.rows.length === 0 && <div className="table-empty">Nenhum registro encontrado com esses filtros.</div>}
        </div>
      </div>
      {data && data.rows.length < data.total && (
        <button type="button" className="btn-outline" style={{ alignSelf: 'center', padding: '10px 18px', fontSize: 13 }} onClick={() => load(data.rows.length)}>
          Mostrar mais registros
        </button>
      )}
    </div>
  );
}
