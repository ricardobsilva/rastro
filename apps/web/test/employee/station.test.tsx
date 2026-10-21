import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { StationApp } from '../../src/employee/StationApp';
import { ANA, EMPLOYEES, JOAO, execution, item, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const TEAM = {
  now: '11:40', dateLabel: 'quarta-feira, 21 de outubro',
  members: [{ ...JOAO, done: 3, total: 6, late: 2 }, { ...ANA, done: 0, total: 0, late: 0 }],
};
const card = (o: object) => ({ executionId: 7, checklistId: 'c1', name: 'Abertura do restaurante', dueTime: '10:30', done: 1, total: 3, status: 'progress', ...o });
const TODAY = {
  date: '2026-10-21', dateLabel: 'quarta-feira, 21 de outubro', now: '11:40', greeting: 'Bom dia',
  summary: { total: 6, done: 1, pending: 5, late: 0 },
  cards: [card({}), card({ executionId: 8, checklistId: 'c2', name: 'Organização do salão' })],
  onDemand: [],
};
const ACTS = [{ id: 1, time: '10:12', itemName: 'Conferir mesas', checklistName: 'Abertura', action: 'done', note: '' }];

function server(session: { employee: unknown; since: string | null }) {
  api.get.mockImplementation(async (url: string) => {
    if (url === '/api/session') return session;
    if (url === '/api/station/team') return TEAM;
    if (url === '/api/employees') return EMPLOYEES;
    if (url === '/api/me/today') return TODAY;
    if (url === '/api/me/activities') return ACTS;
    if (url === '/api/me/executions/7') return execution();
    if (url === '/api/me/executions/8') return execution({ id: 8, name: 'Organização do salão' });
    throw new Error(url);
  });
}

beforeEach(() => vi.resetAllMocks());

describe('US10 — estação de trabalho', () => {
  it('sem sessão mostra a equipe com progresso; um toque entra (sucesso)', async () => {
    server({ employee: null, since: null });
    api.post.mockResolvedValue({ employee: JOAO, since: '11:40' });
    renderWithToast(<StationApp />);
    expect(await screen.findByRole('heading', { name: 'Quem vai marcar tarefas agora?' })).toBeInTheDocument();
    expect(screen.getByText('11:40')).toBeInTheDocument();
    const joao = screen.getByRole('button', { name: /João S\./ });
    expect(joao).toHaveTextContent('3/6');
    expect(screen.getByRole('button', { name: /Ana C\./ })).toHaveTextContent('—');
    await userEvent.click(joao);
    expect(api.post).toHaveBeenCalledWith('/api/session', { employeeId: 'e1' });
    expect(await screen.findByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText(/Marcando como/)).toBeInTheDocument();
  });

  it('com sessão: 3 colunas e o primeiro checklist já aberto (sucesso)', async () => {
    server({ employee: JOAO, since: '09:00' });
    renderWithToast(<StationApp />);
    expect(await screen.findByRole('heading', { name: 'Bom dia, João!' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Abertura do restaurante' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abertura do restaurante/ })).toHaveClass('is-selected');
    expect(screen.getByText('Suas últimas marcações')).toBeInTheDocument();
    const team = screen.getByRole('navigation', { name: 'Trocar com um toque' });
    expect(within(team).getByRole('button', { name: /João S\..*Usando agora/ })).toBeInTheDocument();
    expect(within(team).getByRole('button', { name: /João S\./ })).not.toHaveTextContent('2 atrasadas');
  });

  it('selecionar outro checklist carrega a execução dele (sucesso)', async () => {
    server({ employee: JOAO, since: '09:00' });
    renderWithToast(<StationApp />);
    await userEvent.click(await screen.findByRole('button', { name: /Organização do salão/ }));
    expect(await screen.findByRole('heading', { name: 'Organização do salão' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/me/executions/8');
  });

  it('marcar atualiza o resumo do dia e da equipe (sucesso)', async () => {
    server({ employee: JOAO, since: '09:00' });
    api.put.mockResolvedValue(execution({ done: 2 }));
    renderWithToast(<StationApp />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar Verificar guardanapos' }));
    await vi.waitFor(() => expect(api.get.mock.calls.filter(([u]) => u === '/api/me/today').length).toBeGreaterThan(1));
    expect(api.get.mock.calls.filter(([u]) => u === '/api/station/team').length).toBeGreaterThan(1);
  });

  it('"Encerrar e trocar" encerra a sessão e volta à grade (sucesso)', async () => {
    server({ employee: JOAO, since: '09:00' });
    api.del.mockResolvedValue(null);
    renderWithToast(<StationApp />);
    await userEvent.click(await screen.findByRole('button', { name: 'Encerrar e trocar' }));
    expect(api.del).toHaveBeenCalledWith('/api/session');
    expect(await screen.findByRole('heading', { name: 'Quem vai marcar tarefas agora?' })).toBeInTheDocument();
  });

  it('trocar pela coluna Equipe faz login do colega (sucesso)', async () => {
    server({ employee: JOAO, since: '09:00' });
    api.post.mockResolvedValue({ employee: ANA, since: '11:40' });
    renderWithToast(<StationApp />);
    const team = await screen.findByRole('navigation', { name: 'Trocar com um toque' });
    await userEvent.click(within(team).getByRole('button', { name: /Ana C\./ }));
    expect(api.post).toHaveBeenCalledWith('/api/session', { employeeId: 'e2' });
    expect(await screen.findByRole('heading', { name: 'Bom dia, Ana!' })).toBeInTheDocument();
  });

  it('concluir com obrigatório pendente mostra o erro no painel (erro)', async () => {
    server({ employee: JOAO, since: '09:00' });
    api.post.mockRejectedValue(new ApiError(422, 'Falta 1 item obrigatório: Conferir talheres.'));
    renderWithToast(<StationApp />);
    await screen.findByRole('heading', { name: 'Abertura do restaurante' });
    await userEvent.click(screen.getByRole('button', { name: 'Concluir checklist' }));
    expect(await screen.findByText('Falta 1 item obrigatório: Conferir talheres.')).toBeInTheDocument();
  });

  it('100% mostra lembrete de encerrar para o próximo colega (borda)', async () => {
    server({ employee: JOAO, since: '09:00' });
    api.get.mockImplementation(async (url: string) => {
      if (url === '/api/session') return { employee: JOAO, since: '09:00' };
      if (url === '/api/station/team') return TEAM;
      if (url === '/api/me/today') return TODAY;
      if (url === '/api/me/activities') return [];
      return execution({ done: 1, total: 1, status: 'done', items: [item({ status: 'done', doneAt: '10:00' })] });
    });
    renderWithToast(<StationApp />);
    expect(await screen.findByText('Tudo registrado em nome de João. Não esqueça de encerrar para o próximo colega.')).toBeInTheDocument();
    expect(screen.queryByText('Suas últimas marcações')).not.toBeInTheDocument();
  });

  it('sem checklists hoje: mensagem no painel de execução (borda)', async () => {
    server({ employee: JOAO, since: '09:00' });
    api.get.mockImplementation(async (url: string) => {
      if (url === '/api/session') return { employee: JOAO, since: '09:00' };
      if (url === '/api/station/team') return TEAM;
      if (url === '/api/me/activities') return [];
      return { ...TODAY, cards: [], summary: { total: 0, done: 0, pending: 0, late: 0 } };
    });
    renderWithToast(<StationApp />);
    expect(await screen.findByText('Nenhum checklist atribuído a você hoje.')).toBeInTheDocument();
    expect(screen.getByText('Selecione um checklist à esquerda.')).toBeInTheDocument();
  });
});
