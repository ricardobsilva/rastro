import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { TeamPage } from '../../src/admin/TeamPage';
import { renderWithToast } from '../helpers';
import { withAdmin } from './helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const emp = (o: object) => ({ id: 'e1', name: 'João Silva', shortName: 'João S.', firstName: 'João', initials: 'JS', role: 'Garçom', group: 'Salão', color: '#C2502F', active: true, hasPin: false, isManager: false, ...o });
const EMPS = [emp({}), emp({ id: 'e8', name: 'Paula Nunes', firstName: 'Paula', initials: 'PN', role: 'Garçonete', active: false })];

function server() {
  api.get.mockImplementation(async (url: string) => {
    if (url === '/api/admin/employees') return EMPS;
    if (url.startsWith('/api/admin/team')) return { date: '2026-10-21', dateLabel: 'quarta-feira, 21 de outubro', rows: [] };
    if (url.startsWith('/api/admin/dates')) return [{ value: '2026-10-21', label: 'Hoje · 21/10' }];
    throw new Error(url);
  });
}
const row = (name: string) => screen.getByText(name).closest('.table-row') as HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  server();
});

describe('US13 — Equipe: cadastro e ativação', () => {
  it('lista funcionários com "· Inativo" e abre o modal de novo (sucesso)', async () => {
    renderWithToast(withAdmin(<TeamPage />));
    expect(await screen.findByText('João Silva')).toBeInTheDocument();
    expect(row('Paula Nunes')).toHaveTextContent('Garçonete · Inativo');
    await userEvent.click(screen.getByRole('button', { name: '+ Novo funcionário' }));
    expect(screen.getByRole('dialog', { name: 'Novo funcionário' })).toBeInTheDocument();
  });

  it('Editar abre o modal preenchido (sucesso)', async () => {
    renderWithToast(withAdmin(<TeamPage />));
    await userEvent.click(within(await screen.findByText('João Silva').then((n) => n.closest('.table-row') as HTMLElement)).getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Nome completo')).toHaveValue('João Silva');
  });

  it('Desativar no detalhe pede à API e avisa que o histórico continua (sucesso)', async () => {
    api.patch.mockResolvedValue(emp({ active: false }));
    renderWithToast(withAdmin(<TeamPage />));
    await userEvent.click(await screen.findByText('João Silva'));
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    expect(api.patch).toHaveBeenCalledWith('/api/admin/employees/e1', { active: false });
    expect(await screen.findByRole('status')).toHaveTextContent('João Silva foi desativado. O histórico dele continua disponível.');
    expect(screen.getByRole('button', { name: 'Reativar' })).toBeInTheDocument();
  });

  it('último gestor: erro da API vira aviso (erro)', async () => {
    api.patch.mockRejectedValue(new ApiError(422, 'É preciso manter pelo menos um gestor ativo.'));
    renderWithToast(withAdmin(<TeamPage />));
    await userEvent.click(await screen.findByText('João Silva'));
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('É preciso manter pelo menos um gestor ativo.');
  });

  it('sem seleção mostra a orientação (borda)', async () => {
    renderWithToast(withAdmin(<TeamPage />));
    expect(await screen.findByText(/Selecione um funcionário para ver o detalhamento do dia/)).toBeInTheDocument();
  });
});
