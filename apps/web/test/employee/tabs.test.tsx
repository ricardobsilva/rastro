import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { EmployeeApp } from '../../src/employee/EmployeeApp';
import { EMPLOYEES, JOAO, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));
vi.mock('../../src/employee/TodayScreen', () => ({ TodayScreen: () => <h1>Meu dia</h1> }));
vi.mock('../../src/employee/ActivitiesScreen', () => ({ ActivitiesScreen: () => <h1>Minhas atividades</h1> }));

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation(async (url: string) => (url === '/api/session' ? { employee: JOAO, since: '09:31' } : EMPLOYEES));
});

async function enter() {
  renderWithToast(<EmployeeApp />);
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar como João' }));
}

describe('US08 — navegação por abas', () => {
  it('Hoje · Atividades · Perfil (sucesso)', async () => {
    await enter();
    await userEvent.click(screen.getByRole('tab', { name: 'Atividades' }));
    expect(screen.getByRole('heading', { name: 'Minhas atividades' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Atividades' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Perfil' }));
    expect(screen.getByText(/Identificado desde as 09:31/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Hoje' }));
    expect(screen.getByRole('heading', { name: 'Meu dia' })).toBeInTheDocument();
  });

  it('"Sair deste aparelho" encerra a sessão e volta à identificação (sucesso)', async () => {
    api.del.mockResolvedValue(null);
    await enter();
    await userEvent.click(screen.getByRole('tab', { name: 'Perfil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sair deste aparelho' }));
    expect(api.del).toHaveBeenCalledWith('/api/session');
    expect(await screen.findByRole('heading', { name: 'Quem está trabalhando agora?' })).toBeInTheDocument();
  });

  it('falha ao sair mantém o perfil e avisa (erro)', async () => {
    api.del.mockRejectedValue(new ApiError(0, 'Sem conexão com o servidor.'));
    await enter();
    await userEvent.click(screen.getByRole('tab', { name: 'Perfil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sair deste aparelho' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Sem conexão com o servidor.');
    expect(screen.getByRole('button', { name: 'Sair deste aparelho' })).toBeInTheDocument();
  });

  it('abas não aparecem na tela de retorno (borda)', async () => {
    renderWithToast(<EmployeeApp />);
    await screen.findByRole('button', { name: 'Continuar como João' });
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
