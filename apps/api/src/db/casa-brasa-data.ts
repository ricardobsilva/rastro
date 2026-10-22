// Dados fictícios do cliente-piloto "Casa Brasa" (espelham o protótipo). Só para testes e demonstração local.
type Period = 'daily' | 'weekdays' | 'weekly' | 'ondemand';

export const EMPLOYEES = [
  { id: 'e1', name: 'João Silva', role: 'Garçom', grp: 'Salão', color: '#C2502F' },
  { id: 'e2', name: 'Ana Costa', role: 'Garçonete', grp: 'Salão', color: '#2F6F8F' },
  { id: 'e3', name: 'Carlos Mendes', role: 'Cozinheiro', grp: 'Cozinha', color: '#8A5A12' },
  { id: 'e4', name: 'Beatriz Rocha', role: 'Auxiliar de cozinha', grp: 'Cozinha', color: '#5B4B8A' },
  { id: 'e5', name: 'Rafael Lima', role: 'Bartender', grp: 'Bar', color: '#1F4D3B' },
  { id: 'e7', name: 'Diego Souza', role: 'Auxiliar de limpeza', grp: 'Limpeza', color: '#4A5560' },
  { id: 'e6', name: 'Marina Alves', role: 'Gerente', grp: 'Gerência', color: '#9C3B54', pin: '1234' },
  { id: 'e8', name: 'Paula Nunes', role: 'Garçonete', grp: 'Salão', color: '#6B6A63', active: false },
];

export const CHECKLISTS: {
  id: string; name: string; description: string; items: string[]; dueTime: string | null;
  period: Period; days: number[]; roles: string[]; employees: string[];
}[] = [
  { id: 'c1', name: 'Abertura do restaurante', description: 'Preparação do salão antes da abertura das portas.', items: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'], dueTime: '10:30', period: 'daily', days: [], roles: ['Salão'], employees: [] },
  { id: 'c2', name: 'Organização do salão', description: 'Ajustes finais antes do almoço.', items: ['i14', 'i25', 'i15'], dueTime: '11:30', period: 'daily', days: [], roles: ['Salão'], employees: [] },
  { id: 'c4', name: 'Abertura da cozinha', description: '', items: ['i7', 'i8', 'i11', 'i10', 'i6'], dueTime: '10:00', period: 'daily', days: [], roles: [], employees: ['e4'] },
  { id: 'c3', name: 'Conferência de estoque', description: 'Estoque seco, câmaras e bebidas.', items: ['i5', 'i9', 'i12', 'i22', 'i8'], dueTime: '11:00', period: 'daily', days: [], roles: [], employees: ['e3'] },
  { id: 'c6', name: 'Abertura do bar', description: '', items: ['i12', 'i13', 'i15'], dueTime: '11:00', period: 'daily', days: [], roles: [], employees: ['e5'] },
  { id: 'c9', name: 'Limpeza geral', description: '', items: ['i4', 'i16', 'i11'], dueTime: '09:30', period: 'daily', days: [], roles: ['Limpeza'], employees: [] },
  { id: 'c8', name: 'Limpeza da coifa', description: 'Limpeza profunda semanal.', items: ['i23', 'i11'], dueTime: '15:00', period: 'weekly', days: [3], roles: [], employees: ['e7'] },
  { id: 'c5', name: 'Fechamento do salão', description: 'Deixar o salão pronto para o dia seguinte.', items: ['i26', 'i16', 'i1'], dueTime: '23:30', period: 'daily', days: [], roles: ['Salão'], employees: [] },
  { id: 'c7', name: 'Fechamento do restaurante', description: '', items: ['i17', 'i18', 'i19', 'i20', 'i21'], dueTime: '23:45', period: 'daily', days: [], roles: [], employees: ['e6'] },
  { id: 'c10', name: 'Recebimento de compras', description: 'Usar sempre que chegar mercadoria.', items: ['i22', 'i9', 'i5'], dueTime: null, period: 'ondemand', days: [], roles: ['Cozinha'], employees: [] },
  { id: 'c11', name: 'Conferência da adega', description: '', items: ['i12', 'i9'], dueTime: '16:00', period: 'weekdays', days: [1, 4], roles: [], employees: ['e5'] },
];
