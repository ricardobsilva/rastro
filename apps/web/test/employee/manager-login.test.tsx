import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { ManagerLogin } from '../../src/employee/ManagerLogin';
import { MARINA, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

beforeEach(() => vi.resetAllMocks());

async function typePin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const d of pin) await user.click(screen.getByRole('button', { name: d }));
}

describe('Entrar como gestor pela tela inicial', () => {
  it('PIN correto abre o painel do gestor (sucesso)', async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    api.post.mockResolvedValue({ manager: MARINA });
    renderWithToast(<ManagerLogin go={go} />);

    await user.click(screen.getByRole('button', { name: 'Entrar como gestor' }));
    expect(screen.getByRole('dialog', { name: 'Entrar como gestor' })).toBeInTheDocument();
    await typePin(user, '1234');

    expect(api.post).toHaveBeenCalledWith('/api/admin/login', { pin: '1234' });
    expect(go).toHaveBeenCalledWith('/gestor');
  });

  it('PIN errado mostra o erro e não sai da tela (erro)', async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    api.post.mockRejectedValue(new ApiError(401, 'PIN incorreto.'));
    renderWithToast(<ManagerLogin go={go} />);

    await user.click(screen.getByRole('button', { name: 'Entrar como gestor' }));
    await typePin(user, '9999');

    expect(await screen.findByRole('alert')).toHaveTextContent('PIN incorreto.');
    expect(go).not.toHaveBeenCalled();
  });

  it('cancelar fecha o PIN sem chamar a API (borda)', async () => {
    const user = userEvent.setup();
    renderWithToast(<ManagerLogin go={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Entrar como gestor' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
