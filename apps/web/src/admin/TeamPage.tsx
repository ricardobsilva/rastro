import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useResource } from '../api/useResource';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import { STATUS, pct } from '../ui/status';
import { EmployeeModal, type EmployeeDraft } from './EmployeeModal';
import { useAdmin } from './context';
import type { AdminEmployee, TeamData, TeamRow } from './types';
import { useDates } from './useDates';

const COLS = 'minmax(150px,2fr) 48px 48px minmax(100px,1.2fr) 72px 52px';
const EMPTY_ROW = (id: string): TeamRow => ({ employeeId: id, total: 0, done: 0, late: 0, groups: [] });

export function TeamPage() {
  const toast = useToast();
  const { date, setDate, selectedEmployee } = useAdmin();
  const dates = useDates();
  const emps = useResource<AdminEmployee[]>('/api/admin/employees');
  const team = useResource<TeamData>(`/api/admin/team${date ? `?date=${date}` : ''}`);
  const [selected, setSelected] = useState<string | null>(selectedEmployee);
  const [modal, setModal] = useState<EmployeeDraft | null>(null);

  const stats = (id: string) => team.data?.rows.find((r) => r.employeeId === id) ?? EMPTY_ROW(id);
  const sel = emps.data?.find((e) => e.id === selected);

  async function toggleActive(e: AdminEmployee) {
    try {
      const saved = await api.patch<AdminEmployee>(`/api/admin/employees/${e.id}`, { active: !e.active });
      emps.setData((list) => list?.map((x) => (x.id === e.id ? saved : x)) ?? null);
      team.reload();
      toast(e.active ? `${e.name} foi desativado. O histórico dele continua disponível.` : `${e.name} foi reativado.`, e.active ? 'warn' : 'ok');
    } catch (err) {
      toast(errorMessage(err), 'warn');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Acompanhamento</div>
          <h1 className="page-title">Equipe</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="select" aria-label="Data" value={date ?? dates[0]?.value ?? ''} onChange={(e) => setDate(e.target.value === dates[0]?.value ? null : e.target.value)}>
            {dates.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => setModal({ name: '', role: '', group: 'Salão' })}>+ Novo funcionário</button>
        </div>
      </div>
      {(emps.error || team.error) && <div className="banner banner--error">{emps.error ?? team.error}</div>}
      <div className="team-grid">
        <div className="table-wrap">
          <div style={{ minWidth: 520 }}>
            <div className="table-row table-head" style={{ gridTemplateColumns: COLS }}>
              <span>Funcionário</span><span>Atrib.</span><span>Concl.</span><span>Execução</span><span>Pend.</span><span />
            </div>
            {emps.data?.map((e) => {
              const s = stats(e.id);
              return (
                <div
                  key={e.id}
                  className={`table-row table-row--click${e.id === selected ? ' is-selected' : ''}`}
                  style={{ gridTemplateColumns: COLS, opacity: e.active ? 1 : 0.55 }}
                  onClick={() => setSelected(e.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Avatar initials={e.initials} color={e.color} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: '600 14px var(--font-ui)' }}>{e.name}</div>
                      <div className="muted-sm">{e.role}{e.active ? '' : ' · Inativo'}</div>
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 14 }}>{s.total}</span>
                  <span className="mono" style={{ fontSize: 14 }}>{s.done}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="bar" style={{ height: 6 }}><div className="bar-fill" style={{ width: `${pct(s.done, s.total)}%`, background: s.late ? '#C2502F' : '#1F4D3B' }} /></div>
                    <span className="mono" style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{s.total ? `${pct(s.done, s.total)}%` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ font: '600 13px var(--font-ui)', color: '#5E5D57' }}>{s.total - s.done}</span>
                    {s.late > 0 && <span className="chip chip--late" style={{ padding: '1px 6px', fontSize: 11 }}>{s.late} atr.</span>}
                  </div>
                  <button type="button" className="text-btn" style={{ fontSize: 12, padding: 4 }} onClick={(ev) => { ev.stopPropagation(); setModal(e); }}>
                    Editar
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {sel ? (
          <TeamDetail employee={sel} row={stats(sel.id)} dateLabel={team.data?.dateLabel ?? ''} isToday={team.data?.isToday ?? true} onToggle={() => toggleActive(sel)} />
        ) : (
          <div className="empty" style={{ padding: '40px 20px' }}>Selecione um funcionário para ver o detalhamento do dia, com o horário de cada conclusão.</div>
        )}
      </div>
      {modal && (
        <EmployeeModal
          employee={modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            emps.reload();
            team.reload();
          }}
        />
      )}
    </div>
  );
}

type DetailProps = { employee: AdminEmployee; row: TeamRow; dateLabel: string; isToday: boolean; onToggle: () => void };

function TeamDetail({ employee: e, row, dateLabel, isToday, onToggle }: DetailProps) {
  return (
    <div className="panel" style={{ padding: 20, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar initials={e.initials} color={e.color} size={48} />
        <div style={{ flex: 1 }}>
          <h2 className="detail-title">{e.firstName} — {e.role}</h2>
          <div className="muted-sm" style={{ fontSize: 13 }}>{dateLabel}</div>
        </div>
        <button type="button" className="btn-outline" onClick={onToggle}>{e.active ? 'Desativar' : 'Reativar'}</button>
      </div>
      <div className="counters">
        <div className="counter"><div className="counter-n">{row.total}</div><div className="counter-l">tarefas atribuídas</div></div>
        <div className="counter counter--ok"><div className="counter-n">{row.done}</div><div className="counter-l">concluídas</div></div>
        <div className="counter counter--warn"><div className="counter-n">{row.total - row.done}</div><div className="counter-l">pendentes</div></div>
      </div>
      {row.groups.map((g) => (
        <div key={g.checklistName}>
          <div className="detail-group-head"><span>{g.checklistName}</span><span>{g.dueTime ? `até ${g.dueTime}` : 'sob demanda'}</span></div>
          {g.items.map((x) => (
            <div key={x.itemName} className="detail-item">
              <span className="detail-dot" style={{ background: STATUS[x.status].fg }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '500 14px var(--font-ui)' }}>{x.itemName}</div>
                {x.note && <div className="muted-sm">“{x.note}”</div>}
              </div>
              <span className="mono" style={{ fontSize: 12, color: STATUS[x.status].fg }}>
                {x.status === 'done' ? `✓ ${x.doneAt}` : x.status === 'late' ? (isToday ? 'atrasado' : 'não feito') : 'pendente'}
              </span>
            </div>
          ))}
        </div>
      ))}
      {row.total === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20, fontSize: 14 }}>Sem tarefas atribuídas nesta data.</div>}
    </div>
  );
}
