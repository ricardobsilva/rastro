import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { TodayScreen } from '../../src/employee/TodayScreen';
import { JOAO, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const card = (o: object) => ({ executionId: 1, checklistId: 'c1', name: 'Abertura do restaurante', dueTime: '10:30', done: 4, total: 6, status: 'late', ...o });
const TODAY = {
  date: '2026-10-21', dateLabel: 'quarta-feira, 21 de outubro', now: '11:40', greeting: 'Bom dia',
  summary: { total: 12, done: 8, pending: 4, late: 2 },
  cards: [card({}), card({ executionId: 2, checklistId: 'c2', name: 'Organização do salão', dueTime: '11:30', done: 3, total: 3, status: 'done' })],
  onDemand: [],
};

beforeEach(() => vi.resetAllMocks());

describe('US03 — tela Meu dia', () => {
  it('mostra saudação, resumo e cartões (sucesso)', async () => {
    api.get.mockResolvedValue(TODAY);
    renderWithToast(<TodayScreen me={JOAO} onOpen={vi.fn()} onSwitch={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Bom dia, João!' })).toBeInTheDocument();
    expect(screen.getByText('quarta-feira, 21 de outubro')).toBeInTheDocument();
    expect(screen.getByText('Você possui 12 atividades para hoje.')).toBeInTheDocument();
    expect(screen.getByText('8 de 12 tarefas concluídas')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('2 atrasadas')).toBeInTheDocument();
    const first = screen.getByRole('button', { name: /Abertura do restaurante/ });
    expect(first).toHaveTextContent('Até 10:30 · 6 itens');
    expect(first).toHaveTextContent('Atrasado');
    expect(first).toHaveTextContent('4/6');
    expect(screen.getByRole('button', { name: /Organização do salão/ })).toHaveTextContent('Concluído');
  });

  it('tocar no cartão abre a execução; tocar na foto abre a troca (sucesso)', async () => {
    api.get.mockResolvedValue(TODAY);
    const onOpen = vi.fn();
    const onSwitch = vi.fn();
    renderWithToast(<TodayScreen me={JOAO} onOpen={onOpen} onSwitch={onSwitch} />);
    await userEvent.click(await screen.findByRole('button', { name: /Abertura do restaurante/ }));
    expect(onOpen).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: /Trocar/ }));
    expect(onSwitch).toHaveBeenCalled();
  });

  it('falha ao carregar mostra erro com "Tentar de novo" (erro)', async () => {
    api.get.mockRejectedValueOnce(new ApiError(500, 'Erro interno.')).mockResolvedValueOnce(TODAY);
    renderWithToast(<TodayScreen me={JOAO} onOpen={vi.fn()} onSwitch={vi.fn()} />);
    expect(await screen.findByText('Erro interno.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Bom dia, João!' })).toBeInTheDocument();
  });

  it('sem checklists mostra "Nada para hoje" e não mostra chip de atraso (borda)', async () => {
    api.get.mockResolvedValue({ ...TODAY, summary: { total: 0, done: 0, pending: 0, late: 0 }, cards: [] });
    renderWithToast(<TodayScreen me={JOAO} onOpen={vi.fn()} onSwitch={vi.fn()} />);
    expect(await screen.findByText('Nada para hoje')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText(/atrasadas/)).not.toBeInTheDocument();
  });

  it('singular: "1 atividade" e cartão sob demanda sem prazo (borda)', async () => {
    api.get.mockResolvedValue({
      ...TODAY, summary: { total: 1, done: 0, pending: 1, late: 0 },
      cards: [card({ name: 'Recebimento de compras', dueTime: null, done: 0, total: 1, status: 'pending' })],
    });
    renderWithToast(<TodayScreen me={JOAO} onOpen={vi.fn()} onSwitch={vi.fn()} />);
    expect(await screen.findByText('Você possui 1 atividade para hoje.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recebimento de compras/ })).toHaveTextContent('Sob demanda · 1 item');
  });

  it('recarrega sozinho a cada 30 s para recalcular atrasos (borda)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.get.mockResolvedValue(TODAY);
    renderWithToast(<TodayScreen me={JOAO} onOpen={vi.fn()} onSwitch={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Bom dia, João!' });
    expect(api.get).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(api.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
