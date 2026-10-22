import { CATEGORIES } from '@rastro/domain';
import { useState } from 'react';
import { useResource } from '../api/useResource';
import { Avatar } from '../ui/Avatar';
import { toneOf } from '../ui/categories';
import { pct } from '../ui/status';
import { useAdmin } from './context';
import type { AdminChecklist, AdminEmployee, Dashboard } from './types';
import { useDates } from './useDates';

type Filters = { employeeId: string; category: string; checklistId: string; status: string };
const NONE: Filters = { employeeId: 'all', category: 'all', checklistId: 'all', status: 'all' };

export function DashboardPage() {
  const { date, setDate, go } = useAdmin();
  const dates = useDates();
  const [f, setF] = useState<Filters>(NONE);
  const emps = useResource<AdminEmployee[]>('/api/admin/employees');
  const cls = useResource<AdminChecklist[]>('/api/admin/checklists');

  const qs = new URLSearchParams();
  if (date) qs.set('date', date);
  for (const [k, v] of Object.entries(f)) if (v !== 'all') qs.set(k, v);
  const query = qs.toString();
  const { data: d, error } = useResource<Dashboard>(`/api/admin/dashboard${query ? `?${query}` : ''}`, { pollMs: 30_000 });
  const filtered = Object.values(f).some((v) => v !== 'all');
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="page" style={{ gap: 20 }}>
      <div>
        <div className="eyebrow">{d ? `${d.dateLabel}${d.isToday ? ` · agora ${d.now}` : ''}` : ' '}</div>
        <h1 className="page-title">Operação do dia</h1>
      </div>

      {cls.data?.length === 0 && (
        <div className="guide-invite">
          <div>
            <h2 className="guide-invite-title">Vamos começar?</h2>
            <p className="guide-invite-text">Ainda não há nenhuma lista de tarefas. O passo a passo ajuda você a criar a primeira em poucos minutos.</p>
          </div>
          <button type="button" className="guide-btn guide-btn--primary" onClick={() => go('guide')}>Começar o passo a passo</button>
        </div>
      )}

      <div className="filters">
        <select className="select" aria-label="Data" value={date ?? dates[0]?.value ?? ''} onChange={(e) => setDate(e.target.value === dates[0]?.value ? null : e.target.value)}>
          {dates.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="select" aria-label="Funcionário" value={f.employeeId} onChange={set('employeeId')}>
          <option value="all">Todos os funcionários</option>
          {emps.data?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="select" aria-label="Categoria" value={f.category} onChange={set('category')}>
          <option value="all">Todas as categorias</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select" aria-label="Checklist" value={f.checklistId} onChange={set('checklistId')}>
          <option value="all">Todos os checklists</option>
          {cls.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" aria-label="Status" value={f.status} onChange={set('status')}>
          <option value="all">Todos os status</option>
          <option value="done">Concluídas</option>
          <option value="pending">Pendentes</option>
          <option value="late">Atrasadas</option>
        </select>
        {filtered && <button type="button" className="text-btn" onClick={() => setF(NONE)}>Limpar filtros</button>}
      </div>

      {error && <div className="banner banner--error">{error}</div>}
      {d && <DashboardBody d={d} onOpen={(employeeId) => go('team', { employeeId })} />}
    </div>
  );
}

function DashboardBody({ d, onOpen }: { d: Dashboard; onOpen: (employeeId: string) => void }) {
  const k = d.kpis;
  const kpis = [
    { label: 'Tarefas previstas', value: k.total, sub: k.total ? `${k.checklists} checklists em execução` : '—', cls: '' },
    { label: 'Concluídas', value: k.done, sub: `${pct(k.done, k.total)}% do total`, cls: 'kpi--done' },
    { label: 'Pendentes', value: k.pending, sub: 'dentro do prazo', cls: '' },
    { label: 'Atrasadas', value: k.late, sub: d.isToday ? 'fora do horário previsto' : 'não realizadas', cls: k.late ? 'kpi--late' : '' },
    { label: 'Conclusão', value: `${k.pct}%`, sub: 'percentual do dia', cls: 'kpi--hero' },
  ];

  return (
    <>
      <div className="kpis">
        {kpis.map((x) => (
          <div key={x.label} className={`kpi ${x.cls}`}>
            <div className="kpi-label">{x.label}</div>
            <div className="kpi-value">{x.value}</div>
            <div className="kpi-sub">{x.sub}</div>
          </div>
        ))}
      </div>

      {k.total === 0 && (
        <div className="empty" style={{ padding: 40 }}>
          <div className="empty-title">Nenhuma tarefa com esses filtros</div>
          Tente outra data ou limpe os filtros.
        </div>
      )}

      <div className="dash-row dash-row--wide">
        <section className="panel" aria-labelledby="dash-cl">
          <div className="panel-head">
            <div id="dash-cl" className="panel-title">Conclusão por checklist</div>
            <div className="legend">
              <span><i style={{ background: '#1F4D3B' }} />Concluído</span>
              <span><i style={{ background: '#C2502F' }} />Atrasado</span>
              <span><i style={{ background: '#E4DCCD' }} />Pendente</span>
            </div>
          </div>
          {d.byChecklist.map((b) => (
            <div key={b.name} className="stack" style={{ gap: 5 }} title={`${b.name}: ${b.done} concluídos, ${b.late} atrasados, ${b.total - b.done - b.late} pendentes`}>
              <div className="bar-label"><span>{b.name}</span><span className="mono muted-mono">{b.done}/{b.total}</span></div>
              <div className="stacked">
                <div style={{ width: `${pct(b.done, b.total)}%`, background: '#1F4D3B' }} />
                <div style={{ width: `${pct(b.late, b.total)}%`, background: '#C2502F' }} />
              </div>
            </div>
          ))}
        </section>

        <section className="panel" style={{ gap: 6 }} aria-labelledby="dash-late">
          <div className="panel-head" style={{ marginBottom: 6 }}>
            <div id="dash-late" className="panel-title">Atrasos</div>
            <span style={{ font: '600 12px var(--font-ui)', color: 'var(--late)' }}>{d.lateCount} itens</span>
          </div>
          {d.lateList.map((r, i) => (
            <button key={i} type="button" className="list-btn" onClick={() => onOpen(r.employeeId)}>
              <Avatar initials={r.initials} color={r.color} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 14px var(--font-ui)' }}>{r.itemName}</div>
                <div className="muted-sm">{r.firstName} · {r.checklistName}</div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--late)' }}>{r.delayMin === null ? 'não feito' : `+${r.delayMin} min`}</div>
                <div className="muted-sm" style={{ fontSize: 11 }}>previsto {r.due}</div>
              </div>
            </button>
          ))}
          {d.lateList.length === 0 && <div className="panel-empty">Nenhum atraso. A operação está em dia.</div>}
        </section>
      </div>

      <div className="dash-row">
        <section className="panel" aria-labelledby="dash-trend">
          <div id="dash-trend" className="panel-title">Últimos 8 dias</div>
          <div className="trend">
            {d.trend.map((t) => (
              <div key={t.date} className="trend-col" title={`${t.label}: ${t.pct}% concluído`}>
                <span className="mono muted-mono" style={{ fontSize: 11 }}>{t.pct}%</span>
                <div data-testid="trend-bar" className="trend-bar" style={{ height: Math.max(4, t.pct), background: t.date === d.date ? '#C2502F' : '#1F4D3B' }} />
                <span style={{ font: '600 11px var(--font-ui)' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" style={{ gap: 10 }} aria-labelledby="dash-cat">
          <div id="dash-cat" className="panel-title">Por categoria</div>
          {d.byCategory.map((b) => (
            <div key={b.category} className="cat-row" title={`${b.category}: ${b.pct}% de ${b.n} tarefas`}>
              <span>{b.category}</span>
              <div className="bar"><div className="bar-fill" style={{ width: `${b.pct}%`, background: toneOf(b.category) }} /></div>
              <span className="mono muted-mono" style={{ textAlign: 'right' }}>{b.pct}%</span>
            </div>
          ))}
        </section>

        <section className="panel" style={{ gap: 4 }} aria-labelledby="dash-pend">
          <div id="dash-pend" className="panel-title" style={{ marginBottom: 6 }}>Funcionários com pendências</div>
          {d.pendingByEmployee.map((e) => (
            <button key={e.employeeId} type="button" className="list-btn" onClick={() => onOpen(e.employeeId)}>
              <Avatar initials={e.initials} color={e.color} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 14px var(--font-ui)' }}>{e.name}</div>
                <div className="muted-sm">{e.role}</div>
              </div>
              <span style={{ font: '600 12px var(--font-ui)', color: '#5E5D57' }}>{e.pending} pend.</span>
              {e.late > 0 && <span className="chip chip--late" style={{ padding: '2px 8px' }}>{e.late} atras.</span>}
            </button>
          ))}
          {d.pendingByEmployee.length === 0 && <div className="panel-empty">Todos em dia.</div>}
        </section>
      </div>
    </>
  );
}
