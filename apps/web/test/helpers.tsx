import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ToastProvider } from '../src/ui/Toast';

export const renderWithToast = (ui: ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

export const EMPLOYEES = [
  { id: 'e1', name: 'João Silva', shortName: 'João S.', firstName: 'João', initials: 'JS', role: 'Garçom', group: 'Salão', color: '#C2502F' },
  { id: 'e2', name: 'Ana Costa', shortName: 'Ana C.', firstName: 'Ana', initials: 'AC', role: 'Garçonete', group: 'Salão', color: '#2F6F8F' },
];
export const JOAO = EMPLOYEES[0]!;
export const ANA = EMPLOYEES[1]!;

export const item = (o: object = {}) => ({
  itemId: 'i1', name: 'Conferir organização das mesas', description: 'Mesas alinhadas.', required: true, allowNote: false,
  status: 'pending', doneAt: null, undoneAt: null, note: '', ...o,
});

export const execution = (o: object = {}) => ({
  id: 7, date: '2026-10-21', checklistId: 'c1', name: 'Abertura do restaurante', description: '', dueTime: '10:30',
  done: 1, total: 3, status: 'progress',
  items: [
    item({ status: 'done', doneAt: '10:12' }),
    item({ itemId: 'i2', name: 'Verificar guardanapos', required: false, description: '' }),
    item({ itemId: 'i3', name: 'Conferir talheres', required: false, undoneAt: '10:52' }),
  ],
  ...o,
});
