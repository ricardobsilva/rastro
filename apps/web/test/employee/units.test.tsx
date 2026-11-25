import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { DeviceGate } from '../../src/employee/DeviceGate';
import { StationApp } from '../../src/employee/StationApp';
import { TodayScreen } from '../../src/employee/TodayScreen';
import { JOAO, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const UNITS = [{ id: 'farol', name: 'Farol' }, { id: 'ponta', name: 'Ponta Verde' }];
const type = async (digits: string) => {
  for (const d of digits) await userEvent.click(screen.getByRole('button', { name: d }));
};
const card = (executionId: number, name: string, unit: string | null) => ({ executionId, checklistId: `c${executionId}`, name, unit, dueTime: '10:00', done: 0, total: 2, status: 'pending' });
const today = (cards: object[]) => ({
  date: '', dateLabel: 'quarta', now: '09:00', greeting: 'Bom dia', summary: { total: 4, done: 0, pending: 4, late: 0 }, cards, onDemand: [],
});

beforeEach(() => vi.resetAllMocks());

describe('US21 — unidade do aparelho', () => {
  async function authorize(station: boolean, units = UNITS) {
    api.get.mockResolvedValue({ authorized: false });
    api.post.mockResolvedValue({ authorized: true, units });
    render(<DeviceGate station={station}><p>conteúdo</p></DeviceGate>);
    await screen.findByRole('heading', { name: 'Liberar este aparelho' });
    await type('1234');
  }

  it('computador escolhe a unidade depois do PIN, sem digitar de novo (sucesso)', async () => {
    await authorize(true);
    api.put.mockResolvedValue({ unit: UNITS[0] });
    await userEvent.click(await screen.findByRole('button', { name: 'Farol' }));
    expect(api.put).toHaveBeenCalledWith('/api/device/unit', { pin: '1234', unitId: 'farol' });
    expect(await screen.findByText('conteúdo')).toBeInTheDocument();
  });

  it('falha ao gravar a unidade mantém a pergunta com a mensagem (erro)', async () => {
    await authorize(true);
    api.put.mockRejectedValue(new ApiError(0, 'Sem conexão com o servidor.'));
    await userEvent.click(await screen.findByRole('button', { name: 'Farol' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão');
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('celular pessoal e restaurante sem unidades não perguntam (borda)', async () => {
    await authorize(false);
    expect(await screen.findByText('conteúdo')).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('computador de restaurante sem unidades entra direto (borda)', async () => {
    await authorize(true, []);
    expect(await screen.findByText('conteúdo')).toBeInTheDocument();
  });

  it('estação mostra a unidade e troca com o PIN do gestor (sucesso e erro)', async () => {
    api.get.mockImplementation(async (url: string) =>
      url === '/api/session' ? { employee: null, since: null } : { now: '09:00', dateLabel: 'quarta', unit: UNITS[0], units: UNITS, members: [] });
    renderWithToast(<StationApp />);
    expect(await screen.findByText(/· Farol$/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Trocar unidade' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'Farol' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ponta Verde' }));
    api.put.mockRejectedValueOnce(new ApiError(401, 'PIN sem permissão de gestor.'));
    await type('9999');
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN sem permissão');
    api.put.mockResolvedValue({ unit: UNITS[1] });
    await type('1234');
    expect(api.put).toHaveBeenLastCalledWith('/api/device/unit', { pin: '1234', unitId: 'ponta' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('celular de quem trabalha nas duas separa o Meu dia por unidade; com uma só, não (sucesso e borda)', async () => {
    api.get.mockResolvedValue(today([card(1, 'Abertura', 'Farol'), card(2, 'Estoque', 'Ponta Verde'), card(3, 'Limpeza', null)]));
    const { unmount } = renderWithToast(<TodayScreen me={JOAO} onOpen={vi.fn()} onSwitch={vi.fn()} />);
    expect(within(await screen.findByRole('region', { name: 'Ponta Verde' })).getByText('Estoque')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Todas as unidades' })).toBeInTheDocument();
    unmount();
    api.get.mockResolvedValue(today([card(1, 'Abertura', 'Farol'), card(3, 'Limpeza', null)]));
    renderWithToast(<TodayScreen me={JOAO} onOpen={vi.fn()} onSwitch={vi.fn()} />);
    expect(await screen.findByText('Abertura')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Farol' })).not.toBeInTheDocument();
  });
});
