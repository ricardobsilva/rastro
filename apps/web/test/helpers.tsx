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
