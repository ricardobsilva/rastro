import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { Employee } from '../types';
import { Modal } from '../ui/Modal';
import { PinPad } from '../ui/PinPad';

type Props = { go?: (path: string) => void; className?: string };

/** Atalho da tela inicial: o gestor digita o PIN ali mesmo e cai direto no painel. */
export function ManagerLogin({ go = (path) => window.location.assign(path), className = 'manager-login' }: Props) {
  const [open, setOpen] = useState(false);

  async function login(pin: string) {
    try {
      await api.post<{ manager: Employee }>('/api/admin/login', { pin });
      go('/gestor');
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>Entrar como gestor</button>
      {open && (
        <Modal title="Entrar como gestor" onClose={() => setOpen(false)} width={380}>
          <p className="muted" style={{ textAlign: 'center' }}>Digite o PIN de 4 dígitos para abrir o painel do gestor.</p>
          <PinPad onComplete={login} />
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setOpen(false)}>Cancelar</button>
        </Modal>
      )}
    </>
  );
}
