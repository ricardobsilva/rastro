import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { TodayScreen } from '../../src/employee/TodayScreen';
import { JOAO, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const TODAY = {
  date: '2026-10-21', dateLabel: 'quarta-feira, 21 de outubro', now: '11:40', greeting: 'Bom dia',
  summary: { total: 0, done: 0, pending: 0, late: 0 }, cards: [],
  onDemand: [{ checklistId: 'c10', name: 'Recebimento de compras', description: 'Usar sempre que chegar mercadoria.', itemCount: 3 }],
};

beforeEach(() => vi.resetAllMocks());

describe('US07 — sob demanda (web)', () => {
  it('lista em "Quando necessário" e "Iniciar" abre a execução (sucesso)', async () => {
    api.get.mockResolvedValue(TODAY);
    api.post.mockResolvedValue({ executionId: 42 });
    const onOpen = vi.fn();
    renderWithToast(<TodayScreen me={JOAO} onOpen={onOpen} onSwitch={vi.fn()} />);
    expect(await screen.findByText('Quando necessário')).toBeInTheDocument();
    expect(screen.getByText('3 itens · Usar sempre que chegar mercadoria.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Recebimento de compras' }));
    expect(api.post).toHaveBeenCalledWith('/api/me/ondemand/c10/start');
    expect(onOpen).toHaveBeenCalledWith(42);
  });

  it('erro ao iniciar mostra o motivo (erro)', async () => {
    api.get.mockResolvedValue(TODAY);
    api.post.mockRejectedValue(new ApiError(403, 'Este checklist não está atribuído a você.'));
    const onOpen = vi.fn();
    renderWithToast(<TodayScreen me={JOAO} onOpen={onOpen} onSwitch={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar Recebimento de compras' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Este checklist não está atribuído a você.');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('sem sob demanda não mostra a seção; sem descrição mostra só os itens (borda)', async () => {
    api.get.mockResolvedValueOnce({ ...TODAY, onDemand: [] });
    const { unmount } = renderWithToast(<TodayScreen me={JOAO} onOpen={vi.fn()} onSwitch={vi.fn()} />);
    await screen.findByText('Nada para hoje');
    expect(screen.queryByText('Quando necessário')).not.toBeInTheDocument();
    unmount();
    api.get.mockResolvedValueOnce({ ...TODAY, onDemand: [{ ...TODAY.onDemand[0], description: '', itemCount: 1 }] });
    renderWithToast(<TodayScreen me={JOAO} onOpen={vi.fn()} onSwitch={vi.fn()} />);
    expect(await screen.findByText('1 item')).toBeInTheDocument();
  });
});
