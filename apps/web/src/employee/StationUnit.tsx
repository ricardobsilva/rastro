import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { Unit } from '../types';
import { Modal } from '../ui/Modal';
import { PinPad } from '../ui/PinPad';

type Props = { unit: Unit | null; units: Unit[]; onChanged: (unit: Unit | null) => void };
type Choice = { id: string | null; name: string };

/** Troca a unidade deste computador, com o PIN do gestor. */
export function StationUnit({ unit, units, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const close = () => {
    setOpen(false);
    setChoice(null);
  };

  async function confirm(pin: string) {
    if (!choice) return null;
    try {
      const res = await api.put<{ unit: Unit | null }>('/api/device/unit', { pin, unitId: choice.id });
      close();
      onChanged(res.unit);
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }

  const choices: Choice[] = [...units, { id: null, name: 'Todas as unidades' }].filter((u) => u.id !== (unit?.id ?? null));
  return (
    <>
      <button type="button" className="manager-login station-unit-btn" onClick={() => setOpen(true)}>{unit ? 'Trocar unidade' : 'Definir unidade'}</button>
      {open && (
        <Modal title={choice ? `Usar em: ${choice.name}` : 'Unidade deste computador'} onClose={close} width={380}>
          {choice ? (
            <>
              <p className="muted" style={{ textAlign: 'center' }}>Digite o PIN do gestor para confirmar.</p>
              <PinPad onComplete={confirm} />
            </>
          ) : (
            <div className="unit-options">
              {choices.map((u) => <button key={u.id ?? 'all'} type="button" className="btn btn-primary" onClick={() => setChoice(u)}>{u.name}</button>)}
            </div>
          )}
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={close}>Cancelar</button>
        </Modal>
      )}
    </>
  );
}
