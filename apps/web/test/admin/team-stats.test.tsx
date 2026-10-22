import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { TeamPage } from '../../src/admin/TeamPage';
import { renderWithToast } from '../helpers';
import { withAdmin } from './helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const emp = (o: object) => ({ id: 'e1', name: 'João Silva', shortName: 'João S.', firstName: 'João', initials: 'JS', role: 'Garçom', group: 'Salão', color: '#C2502F', active: true, hasPin: false, isManager: false, ...o });
const EMPS = [emp({}), emp({ id: 'e2', name: 'Ana Costa', firstName: 'Ana', role: 'Garçonete' })];
const TEAM = (isToday = true) => ({
  date: '2026-10-21', dateLabel: 'quarta-feira, 21 de outubro', isToday,
  rows: [
    { employeeId: 'e1', total: 12, done: 3, late: 2, groups: [{ checklistName: 'Abertura do restaurante', dueTime: '10:30', items: [
      { itemName: 'Conferir mesas', status: 'done', doneAt: '10:12', note: '' },
      { itemName: 'Conferir arroz', status: 'late', doneAt: null, note: 'Restam 3 sacos.' },
      { itemName: 'Guardanapos', status: 'pending', doneAt: null, note: '' },
    ] }] },
    { employeeId: 'e2', total: 0, done: 0, late: 0, groups: [] },
  ],
});
function server(team: object = TEAM()) {
  api.get.mockImplementation(async (url: string) => {
    if (url === '/api/admin/employees') return EMPS;
    if (url.startsWith('/api/admin/team')) return team;
    if (url === '/api/admin/dates') return [{ value: '2026-10-21', label: 'Hoje · 21/10' }, { value: '2026-10-20', label: 'Ontem · 20/10' }];
    throw new Error(url);
  });
}
const row = (name: string) => screen.getByText(name).closest('.table-row') as HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  server();
});

describe('US16 — Equipe: acompanhamento', () => {
  it('tabela com atribuídas, concluídas, % e atrasos (sucesso)', async () => {
    renderWithToast(withAdmin(<TeamPage />));
    await screen.findByText('João Silva');
    await vi.waitFor(() => expect(row('João Silva')).toHaveTextContent('25%'));
    expect(row('João Silva')).toHaveTextContent('12');
    expect(row('João Silva')).toHaveTextContent('2 atr.');
    expect(row('Ana Costa')).toHaveTextContent('—');
  });

  it('detalhe agrupa por checklist com horário, atraso e observação (sucesso)', async () => {
    renderWithToast(withAdmin(<TeamPage />, { selectedEmployee: 'e1' }));
    expect(await screen.findByRole('heading', { name: 'João — Garçom' })).toBeInTheDocument();
    await screen.findByText('Conferir mesas');
    expect(screen.getByText('tarefas atribuídas').previousSibling).toHaveTextContent('12');
    expect(screen.getByText('até 10:30')).toBeInTheDocument();
    expect(screen.getByText('✓ 10:12')).toBeInTheDocument();
    expect(screen.getByText('atrasado')).toBeInTheDocument();
    expect(screen.getByText('“Restam 3 sacos.”')).toBeInTheDocument();
    expect(screen.getByText('pendente')).toBeInTheDocument();
  });

  it('dia anterior mostra "não feito"; trocar a data usa o filtro compartilhado (borda)', async () => {
    server(TEAM(false));
    const setDate = vi.fn();
    renderWithToast(withAdmin(<TeamPage />, { selectedEmployee: 'e1', date: '2026-10-20', setDate }));
    expect(await screen.findByText('não feito')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/admin/team?date=2026-10-20');
    await userEvent.selectOptions(screen.getByLabelText('Data'), '2026-10-21');
    expect(setDate).toHaveBeenCalledWith(null);
  });

  it('funcionário sem tarefas mostra estado vazio no detalhe (borda)', async () => {
    renderWithToast(withAdmin(<TeamPage />));
    await userEvent.click(await screen.findByText('Ana Costa'));
    expect(screen.getByText('Sem tarefas atribuídas nesta data.')).toBeInTheDocument();
  });

  it('erro ao carregar a equipe aparece no topo (erro)', async () => {
    api.get.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/admin/team')) throw new ApiError(422, 'Data inválida.');
      return url === '/api/admin/employees' ? EMPS : [];
    });
    renderWithToast(withAdmin(<TeamPage />));
    expect(await screen.findByText('Data inválida.')).toBeInTheDocument();
    expect(within(row('João Silva')).getAllByText('0').length).toBeGreaterThan(0);
  });
});
