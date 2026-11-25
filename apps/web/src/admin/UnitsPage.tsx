import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useResource } from '../api/useResource';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';
import { plural } from '../ui/status';
import { useAdmin } from './context';

type Unit = { id: string; name: string; active: boolean; checklists: number };

export function UnitsPage() {
  const toast = useToast();
  const { refreshBadge } = useAdmin();
  const units = useResource<Unit[]>('/api/admin/units');
  const [modal, setModal] = useState<{ id?: string; name: string } | null>(null);
  const [err, setErr] = useState('');

  const open = (m: { id?: string; name: string }) => {
    setModal(m);
    setErr('');
  };
  const refresh = () => {
    units.reload();
    refreshBadge(); // atualiza o seletor do menu
  };

  async function save() {
    if (!modal) return;
    if (!modal.name.trim()) return setErr('Dê um nome à unidade.');
    const body = { name: modal.name.trim() };
    try {
      await (modal.id ? api.patch(`/api/admin/units/${modal.id}`, body) : api.post('/api/admin/units', body));
      toast(modal.id ? 'Unidade atualizada.' : 'Unidade criada.');
      setModal(null);
      refresh();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function toggle(u: Unit) {
    try {
      await api.patch(`/api/admin/units/${u.id}`, { active: !u.active });
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'warn');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Configuração</div>
          <h1 className="page-title">Unidades</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => open({ name: '' })}>+ Nova unidade</button>
      </div>
      {units.error && <div className="banner banner--error">{units.error}</div>}
      <ul className="unit-list" aria-label="Unidades">
        {units.data?.map((u) => (
          <li key={u.id} className="panel unit-row" style={{ opacity: u.active ? 1 : 0.6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 15px var(--font-ui)' }}>{u.name}</div>
              <div className="muted-sm">{plural(u.checklists, 'checklist ativo', 'checklists ativos')}</div>
            </div>
            <Switch checked={u.active} label={u.active ? 'Ativa' : 'Inativa'} ariaLabel={`${u.name} ativa`} onChange={() => toggle(u)} />
            <button type="button" className="text-btn" aria-label={`Renomear ${u.name}`} onClick={() => open(u)}>Renomear</button>
          </li>
        ))}
      </ul>
      {units.data?.length === 0 && <div className="empty" style={{ padding: 40 }}>Nenhuma unidade cadastrada.</div>}
      {modal && (
        <Modal title={modal.id ? 'Renomear unidade' : 'Nova unidade'} onClose={() => setModal(null)} width={420}>
          {err && <div role="alert" className="banner banner--error" style={{ fontSize: 13 }}>{err}</div>}
          <label className="field">
            Nome da unidade
            <input value={modal.name} maxLength={60} placeholder="Ex.: Farol" onChange={(e) => { setModal({ ...modal, name: e.target.value }); setErr(''); }} />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={save}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
