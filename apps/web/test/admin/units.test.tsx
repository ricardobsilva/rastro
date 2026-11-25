import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminApp } from '../../src/admin/AdminApp';
import { ChecklistsPage } from '../../src/admin/ChecklistsPage';
import { DashboardPage } from '../../src/admin/DashboardPage';
import { GuidePage } from '../../src/admin/GuidePage';
import { HistoryPage } from '../../src/admin/HistoryPage';
import { TeamPage } from '../../src/admin/TeamPage';
import { UnitsPage } from '../../src/admin/UnitsPage';
import { ApiError } from '../../src/api/client';
import { ANA, JOAO, MARINA, renderWithToast } from '../helpers';
import { withAdmin } from './helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const UNITS = [
  { id: 'farol', name: 'Farol', active: true, lateToday: 2 },
  { id: 'ponta', name: 'Ponta Verde', active: true, lateToday: 5 },
];
const emp = (e: object, unitIds: string[]) => ({ ...e, active: true, hasPin: false, isManager: false, unitIds });
const EMPS = [emp(JOAO, ['farol']), emp(ANA, ['farol', 'ponta'])];
const cl = (id: string, name: string, unitId: string | null) => ({
  id, name, description: '', period: 'daily', days: [], dueTime: '10:00', employeeIds: ['e1', 'e2'], itemIds: ['i1'], active: true, unitId, assignees: ['Ana Costa'],
});
const CLS = [cl('c1', 'Abertura', 'farol'), cl('c2', 'Fechamento', 'ponta'), cl('c3', 'Limpeza', null)];
const ITEMS = [{ id: 'i1', name: 'Abrir portas', description: '', category: 'Organização', required: false, allowNote: true, active: true, usedIn: [] }];
const DASH = {
  date: '2026-10-21', isToday: true, now: '11:40', dateLabel: 'quarta', kpis: { total: 10, done: 4, pending: 3, late: 3, pct: 40, checklists: 2 },
  byUnit: [
    { unitId: 'farol', name: 'Farol', total: 6, done: 3, late: 1, pct: 50 },
    { unitId: null, name: 'Sem unidade', total: 4, done: 1, late: 2, pct: 25 },
  ],
  byChecklist: [{ id: 'c1', name: 'Abertura', unit: 'Farol', done: 1, late: 0, total: 2 }, { id: 'c2', name: 'Abertura', unit: 'Ponta Verde', done: 1, late: 0, total: 2 }],
  lateCount: 0, lateList: [], pendingByEmployee: [], byCategory: [], trend: [],
};

function serve(over: Record<string, unknown> = {}) {
  api.get.mockImplementation(async (url: string) => {
    const path = url.split('?')[0]!;
    const routes: Record<string, unknown> = {
      '/api/admin/me': { manager: MARINA, lateToday: 9, units: UNITS }, '/api/admin/checklists': CLS, '/api/admin/employees': EMPS, '/api/admin/items': ITEMS,
      '/api/admin/dates': [], '/api/admin/dashboard': DASH, '/api/admin/history': { total: 0, undone: 0, rows: [] },
      '/api/admin/team': { date: '', dateLabel: '', isToday: true, rows: [] },
      '/api/admin/units': UNITS.map((u) => ({ ...u, checklists: 1 })), ...over,
    };
    return routes[path];
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  serve();
});

describe('US20 — seletor de unidade', () => {
  it('filtra o painel, o badge acompanha e a escolha é lembrada (sucesso)', async () => {
    const { unmount } = renderWithToast(<AdminApp />);
    const group = await screen.findByRole('group', { name: 'Unidade' });
    expect(within(group).getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Painel/ })).toHaveTextContent('9');
    await userEvent.click(within(group).getByRole('button', { name: 'Farol' }));
    expect(screen.getByRole('button', { name: /^Painel/ })).toHaveTextContent('2');
    expect(await screen.findByRole('heading', { name: 'Operação do dia · Farol' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/admin/dashboard?unitId=farol');
    unmount();
    renderWithToast(<AdminApp />);
    expect(await screen.findByRole('button', { name: 'Farol' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('unidade guardada que não existe mais volta para Todas (borda)', async () => {
    window.localStorage.setItem('rastro.gestor.unidade', 'fechada');
    renderWithToast(<AdminApp />);
    expect(await screen.findByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sem unidades cadastradas não mostra o seletor (borda)', async () => {
    serve({ '/api/admin/me': { manager: MARINA, lateToday: 0, units: [] } });
    renderWithToast(<AdminApp />);
    await screen.findByRole('button', { name: 'Checklists' });
    expect(screen.queryByRole('group', { name: 'Unidade' })).not.toBeInTheDocument();
  });
});

describe('US20 — checklists por unidade', () => {
  it('na unidade, só os dela; em Todas, uma seção para cada (sucesso)', async () => {
    const { unmount } = renderWithToast(withAdmin(<ChecklistsPage />, { units: UNITS, unitId: 'ponta' }));
    expect(await screen.findByRole('button', { name: /Fechamento/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Abertura/ })).not.toBeInTheDocument();
    expect(screen.getByText(/1 checklist ainda não tem unidade/)).toBeInTheDocument();
    unmount();
    renderWithToast(withAdmin(<ChecklistsPage />, { units: UNITS }));
    for (const [unit, name] of [['Farol', 'Abertura'], ['Ponta Verde', 'Fechamento'], ['Sem unidade', 'Limpeza']])
      expect(within(await screen.findByRole('list', { name: `Checklists · ${unit}` })).getByRole('button', { name: new RegExp(name!) })).toBeInTheDocument();
  });

  it('checklist novo já nasce na unidade escolhida (sucesso)', async () => {
    renderWithToast(withAdmin(<ChecklistsPage />, { units: UNITS, unitId: 'ponta' }));
    await screen.findByRole('button', { name: /Fechamento/ });
    await userEvent.click(screen.getByRole('button', { name: '+ Criar checklist' }));
    const unit = screen.getByRole('group', { name: 'Unidade do checklist' });
    expect(within(unit).getByRole('button', { name: 'Ponta Verde' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'João' })).not.toBeInTheDocument(); // João é só do Farol
    expect(screen.getByRole('button', { name: 'Ana' })).toBeInTheDocument();
  });

  it('trocar a unidade tira quem não trabalha nela (borda)', async () => {
    renderWithToast(withAdmin(<ChecklistsPage />, { units: UNITS, unitId: 'farol' }));
    const unit = await screen.findByRole('group', { name: 'Unidade do checklist' });
    api.put.mockResolvedValue({ ...CLS[0], unitId: 'ponta' });
    await screen.findByRole('button', { name: 'João' });
    await userEvent.click(within(unit).getByRole('button', { name: 'Ponta Verde' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar checklist' }));
    expect(api.put).toHaveBeenCalledWith('/api/admin/checklists/c1', expect.objectContaining({ unitId: 'ponta', employeeIds: ['e2'] }));
    expect(screen.getByRole('status')).toHaveTextContent('Checklist salvo na unidade Ponta Verde.');
  });

  it('copiar para outra unidade cria um novo, sem pessoas, e não mexe no original (sucesso)', async () => {
    renderWithToast(withAdmin(<ChecklistsPage />, { units: UNITS, unitId: 'farol' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar para Ponta Verde' }));
    expect(screen.getByRole('heading', { name: 'Novo checklist' })).toBeInTheDocument();
    api.post.mockResolvedValue(cl('c9', 'Abertura', 'ponta'));
    await userEvent.click(screen.getByRole('button', { name: 'Ana' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar checklist' }));
    expect(api.post).toHaveBeenCalledWith('/api/admin/checklists', expect.objectContaining({ name: 'Abertura', unitId: 'ponta', employeeIds: ['e2'], itemIds: ['i1'] }));
    expect(api.put).not.toHaveBeenCalled();
  });

  it('servidor recusa sem unidade e a mensagem aparece (erro)', async () => {
    renderWithToast(withAdmin(<ChecklistsPage />, { units: UNITS }));
    await screen.findByRole('button', { name: /Fechamento/ });
    await userEvent.click(screen.getByRole('button', { name: '+ Criar checklist' }));
    api.post.mockRejectedValue(new ApiError(422, 'Escolha a unidade.'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar checklist' }));
    expect(await screen.findByText('Escolha a unidade.')).toBeInTheDocument();
  });
});

describe('US20 — equipe, unidades e passo a passo', () => {
  it('equipe da unidade; cadastro novo já vem com ela marcada (sucesso)', async () => {
    renderWithToast(withAdmin(<TeamPage />, { units: UNITS, unitId: 'ponta' }));
    expect(await screen.findByText('Ana Costa')).toBeInTheDocument();
    expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+ Novo funcionário' }));
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Lia Reis');
    await userEvent.type(screen.getByLabelText('Cargo'), 'Garçonete');
    await userEvent.click(screen.getByRole('button', { name: 'Farol' }));
    api.post.mockResolvedValue({});
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(api.post).toHaveBeenCalledWith('/api/admin/employees', expect.objectContaining({ unitIds: ['ponta', 'farol'] }));
  });

  it('página Unidades: cria, recusa nome vazio e mostra o motivo de não desativar (sucesso e erro)', async () => {
    const refreshBadge = vi.fn();
    renderWithToast(withAdmin(<UnitsPage />, { units: UNITS, refreshBadge }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Nova unidade' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Dê um nome à unidade.');
    await userEvent.type(screen.getByLabelText('Nome da unidade'), 'Jatiúca');
    api.post.mockResolvedValue({});
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(api.post).toHaveBeenCalledWith('/api/admin/units', { name: 'Jatiúca' });
    expect(refreshBadge).toHaveBeenCalled();
    api.patch.mockRejectedValue(new ApiError(409, 'Desative ou mova os checklists desta unidade antes de desativá-la.'));
    await userEvent.click(screen.getByRole('switch', { name: 'Farol ativa' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Desative ou mova');
  });

  it('passo a passo pergunta a unidade primeiro e só oferece as funções com gente nela', async () => {
    renderWithToast(withAdmin(<GuidePage />, { units: UNITS }));
    await userEvent.click(await screen.findByRole('button', { name: 'Começar' }));
    expect(screen.getByRole('heading', { name: 'De qual unidade é esta lista?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a unidade.');
    await userEvent.click(screen.getByRole('button', { name: 'Ponta Verde' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.type(screen.getByLabelText('Nome da lista'), 'Abertura'); // existe só no Farol
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.type(screen.getByLabelText('Nova tarefa'), 'Varrer{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByTestId('guide-team-Salão')).toHaveTextContent('Ana');
    expect(screen.getByTestId('guide-team-Salão')).not.toHaveTextContent('João');
  });
});

describe('US22 — relatórios por unidade', () => {
  it('painel em Todas compara as unidades, distingue nomes iguais e leva à unidade (sucesso)', async () => {
    const setUnitId = vi.fn();
    renderWithToast(withAdmin(<DashboardPage />, { units: UNITS, setUnitId }));
    const cards = await screen.findByRole('region', { name: 'Por unidade' });
    expect(cards).toHaveTextContent('Sem unidade');
    const list = within(screen.getByRole('region', { name: 'Conclusão por checklist' }));
    expect(list.getByText('Abertura · Farol')).toBeInTheDocument();
    expect(list.getByText('Abertura · Ponta Verde')).toBeInTheDocument();
    await userEvent.click(within(cards).getByRole('button', { name: /Farol/ }));
    expect(setUnitId).toHaveBeenCalledWith('farol');
  });

  it('histórico pede só a unidade escolhida', async () => {
    renderWithToast(withAdmin(<HistoryPage />, { units: UNITS, unitId: 'farol' }));
    await screen.findByText('Auditoria · Farol');
    expect(api.get).toHaveBeenCalledWith('/api/admin/history?unitId=farol');
  });
});
