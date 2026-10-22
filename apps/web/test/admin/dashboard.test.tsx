import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { DashboardPage } from '../../src/admin/DashboardPage';
import { renderWithToast } from '../helpers';
import { withAdmin } from './helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const person = { employeeId: 'e1', name: 'João Silva', firstName: 'João', role: 'Garçom', color: '#C2502F', initials: 'JS' };
const DASH = {
  date: '2026-10-21', isToday: true, now: '11:40', dateLabel: 'quarta-feira, 21 de outubro',
  kpis: { total: 40, done: 20, pending: 12, late: 8, pct: 50, checklists: 9 },
  byChecklist: [{ name: 'Organização do salão', done: 1, late: 5, total: 6 }, { name: 'Abertura do restaurante', done: 10, late: 2, total: 12 }],
  lateCount: 8,
  lateList: [{ ...person, itemName: 'Conferir talheres', checklistName: 'Abertura do restaurante', due: '10:30', delayMin: 70 }],
  pendingByEmployee: [{ ...person, pending: 3, late: 2 }],
  byCategory: [{ category: 'Limpeza', n: 10, pct: 60 }],
  trend: Array.from({ length: 8 }, (_, i) => ({ date: `2026-10-${14 + i}`, label: i === 7 ? 'Hoje' : 'Ter', pct: 80 })),
};
const DATES = [{ value: '2026-10-21', label: 'Hoje · 21/10' }, { value: '2026-10-20', label: 'Ontem · 20/10' }];
const CLS = [{ id: 'c1', name: 'Abertura do restaurante' }];
const EMPS = [{ id: 'e1', name: 'João Silva' }];

function server(dash: object = DASH) {
  api.get.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/admin/dashboard')) return dash;
    return ({ '/api/admin/dates': DATES, '/api/admin/checklists': CLS, '/api/admin/employees': EMPS } as Record<string, unknown>)[url];
  });
}
const lastDashUrl = () => api.get.mock.calls.map(([u]) => u as string).filter((u) => u.startsWith('/api/admin/dashboard')).at(-1);

beforeEach(() => {
  vi.resetAllMocks();
  server();
});

describe('US15 — painel (web)', () => {
  it('mostra KPIs, gráficos e listas (sucesso)', async () => {
    renderWithToast(withAdmin(<DashboardPage />));
    expect(await screen.findByRole('heading', { name: 'Operação do dia' })).toBeInTheDocument();
    expect(screen.getByText('quarta-feira, 21 de outubro · agora 11:40')).toBeInTheDocument();
    const kpi = (label: string) => screen.getByText(label, { selector: '.kpi-label' }).closest('.kpi') as HTMLElement;
    expect(kpi('Tarefas previstas')).toHaveTextContent('40');
    expect(kpi('Tarefas previstas')).toHaveTextContent('9 checklists em execução');
    expect(kpi('Atrasadas')).toHaveClass('kpi--late');
    expect(kpi('Conclusão')).toHaveTextContent('50%');
    const late = screen.getByRole('region', { name: 'Atrasos' });
    expect(within(late).getByText('8 itens')).toBeInTheDocument();
    expect(within(late).getByRole('button', { name: /Conferir talheres/ })).toHaveTextContent('+70 min');
    expect(screen.getByRole('region', { name: 'Conclusão por checklist' })).toHaveTextContent('1/6');
    expect(screen.getAllByTestId('trend-bar')).toHaveLength(8);
    expect(screen.getByRole('region', { name: 'Por categoria' })).toHaveTextContent('60%');
  });

  it('clicar num atraso leva à Equipe com o funcionário (sucesso)', async () => {
    const go = vi.fn();
    renderWithToast(withAdmin(<DashboardPage />, { go }));
    await userEvent.click(await screen.findByRole('button', { name: /Conferir talheres/ }));
    expect(go).toHaveBeenCalledWith('team', { employeeId: 'e1' });
  });

  it('filtros montam a consulta; "Limpar filtros" mantém a data (sucesso)', async () => {
    const setDate = vi.fn();
    renderWithToast(withAdmin(<DashboardPage />, { setDate }));
    await screen.findByRole('heading', { name: 'Operação do dia' });
    await userEvent.selectOptions(await screen.findByLabelText('Funcionário'), 'e1');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'late');
    await vi.waitFor(() => expect(lastDashUrl()).toBe('/api/admin/dashboard?employeeId=e1&status=late'));
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await vi.waitFor(() => expect(lastDashUrl()).toBe('/api/admin/dashboard'));
    await userEvent.selectOptions(screen.getByLabelText('Data'), '2026-10-20');
    expect(setDate).toHaveBeenCalledWith('2026-10-20');
  });

  it('dia anterior mostra "não feito" (borda)', async () => {
    server({ ...DASH, isToday: false, lateList: [{ ...DASH.lateList[0], delayMin: null }] });
    renderWithToast(withAdmin(<DashboardPage />, { date: '2026-10-20' }));
    expect(await screen.findByText('não feito')).toBeInTheDocument();
    expect(lastDashUrl()).toBe('/api/admin/dashboard?date=2026-10-20');
    expect(screen.queryByText(/agora/)).not.toBeInTheDocument();
  });

  it('sem resultados mostra estado vazio; sem atrasos e pendências mostra mensagens (borda)', async () => {
    server({ ...DASH, kpis: { total: 0, done: 0, pending: 0, late: 0, pct: 0, checklists: 0 }, byChecklist: [], lateList: [], lateCount: 0, pendingByEmployee: [], byCategory: [] });
    renderWithToast(withAdmin(<DashboardPage />));
    expect(await screen.findByText('Nenhuma tarefa com esses filtros')).toBeInTheDocument();
    expect(screen.getByText('Nenhum atraso. A operação está em dia.')).toBeInTheDocument();
    expect(screen.getByText('Todos em dia.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
  });

  it('erro da API aparece no topo (erro)', async () => {
    api.get.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/admin/dashboard')) throw new ApiError(422, 'Data fora do período disponível.');
      return [];
    });
    renderWithToast(withAdmin(<DashboardPage />));
    expect(await screen.findByText('Data fora do período disponível.')).toBeInTheDocument();
  });
});
