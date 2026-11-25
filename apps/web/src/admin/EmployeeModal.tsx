import { GROUPS, MANAGER_GROUP } from '@rastro/domain';
import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { ChipGroup } from '../ui/ChipGroup';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import type { AdminUnit } from './types';

type Group = (typeof GROUPS)[number];
export type EmployeeDraft = { id?: string; name: string; role: string; group: string; hasPin?: boolean; unitIds?: string[] };
type Props = { employee?: EmployeeDraft; units?: AdminUnit[]; onClose: () => void; onSaved: (e: unknown) => void };

export function EmployeeModal({ employee, units = [], onClose, onSaved }: Props) {
  const toast = useToast();
  const [d, setD] = useState({ name: employee?.name ?? '', role: employee?.role ?? '', group: (employee?.group ?? 'Salão') as Group, pin: '', unitIds: employee?.unitIds ?? [] });
  const [err, setErr] = useState('');
  const upd = (p: Partial<typeof d>) => {
    setD((x) => ({ ...x, ...p }));
    setErr('');
  };
  const options = units.filter((u) => u.active || employee?.unitIds?.includes(u.id));
  const isManager = d.group === MANAGER_GROUP;

  async function save() {
    if (!d.name.trim() || !d.role.trim()) return setErr('Preencha nome e cargo.');
    const body = { name: d.name.trim(), role: d.role.trim(), group: d.group, ...(options.length ? { unitIds: d.unitIds } : {}), ...(isManager && d.pin ? { pin: d.pin } : {}) };
    try {
      const saved = employee?.id ? await api.patch(`/api/admin/employees/${employee.id}`, body) : await api.post('/api/admin/employees', body);
      toast(employee?.id ? 'Funcionário atualizado.' : 'Funcionário cadastrado.');
      onSaved(saved);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <Modal title={employee?.id ? 'Editar funcionário' : 'Novo funcionário'} onClose={onClose} width={480}>
      {err && <div role="alert" className="banner banner--error" style={{ fontSize: 13 }}>{err}</div>}
      <label className="field">
        Nome completo
        <input value={d.name} placeholder="Ex.: Lucas Pereira" onChange={(e) => upd({ name: e.target.value })} />
      </label>
      <label className="field">
        Cargo
        <input value={d.role} placeholder="Ex.: Garçom" onChange={(e) => upd({ role: e.target.value })} />
      </label>
      <div className="field">
        Função (para atribuição de checklists)
        <ChipGroup options={GROUPS} value={d.group} onToggle={(g) => upd({ group: g })} />
      </div>
      {options.length > 0 && (
        <div className="field">
          Unidades
          <ChipGroup
            options={options.map((u) => u.id)} labels={Object.fromEntries(options.map((u) => [u.id, u.name]))} value={d.unitIds}
            onToggle={(id) => upd({ unitIds: d.unitIds.includes(id) ? d.unitIds.filter((x) => x !== id) : [...d.unitIds, id] })}
          />
          <span className="muted-sm" style={{ fontWeight: 400 }}>Sem nenhuma marcada, a pessoa aparece em todas.</span>
        </div>
      )}
      {isManager && (
        <div className="field">
          <label htmlFor="emp-pin">PIN de 4 dígitos</label>
          <input
            id="emp-pin"
            className="pin-input"
            inputMode="numeric"
            maxLength={4}
            value={d.pin}
            placeholder={employee?.hasPin ? '•••• (manter)' : '0000'}
            onChange={(e) => upd({ pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          />
          <span className="muted-sm" style={{ fontWeight: 400 }}>Usado para entrar no painel do gestor e liberar aparelhos.</span>
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={save}>Salvar</button>
      </div>
    </Modal>
  );
}
