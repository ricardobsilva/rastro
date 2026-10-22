import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { EmployeeApp } from '../../src/employee/EmployeeApp';
import { EMPLOYEES, JOAO, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));
vi.mock('../../src/employee/TodayScreen', () => ({
  TodayScreen: ({ me }: { me: { firstName: string } }) => <h1>Meu dia de {me.firstName}</h1>,
}));

function mockServer(session: unknown, employees = EMPLOYEES) {
  api.get.mockImplementation(async (url: string) => {
    if (url === '/api/session') return session;
    if (url === '/api/employees') return employees;
    throw new Error(`GET inesperado ${url}`);
  });
}

beforeEach(() => vi.resetAllMocks());

describe('US02 — identificação', () => {
  it('mostra o restaurante Zé Frôxin, sem subtítulo de demonstração (sucesso)', async () => {
    mockServer({ employee: null, since: null });
    const { container } = renderWithToast(<EmployeeApp />);
    expect(await screen.findByText('Zé Frôxin')).toBeInTheDocument();
    expect(screen.getByText('ZF')).toBeInTheDocument();
    expect(screen.queryByText(/Casa Brasa|Pinheiros/)).not.toBeInTheDocument();
    expect(container.querySelector('.restaurant-tagline')).toBeNull();
  });

  it('tela inicial do celular oferece entrar como gestor (sucesso)', async () => {
    mockServer({ employee: null, since: null });
    renderWithToast(<EmployeeApp />);
    expect(await screen.findByRole('heading', { name: 'Quem está trabalhando agora?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar como gestor' })).toBeInTheDocument();
  });

  it('sem sessão lista a equipe; um toque entra e mostra o toast (sucesso)', async () => {
    mockServer({ employee: null, since: null });
    api.post.mockResolvedValue({ employee: JOAO, since: '09:31' });
    renderWithToast(<EmployeeApp />);

    expect(await screen.findByRole('heading', { name: 'Quem está trabalhando agora?' })).toBeInTheDocument();
    expect(screen.getByText('Ana C.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /João S\./ }));

    expect(api.post).toHaveBeenCalledWith('/api/session', { employeeId: 'e1' });
    expect(await screen.findByRole('heading', { name: 'Meu dia de João' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Olá, João! Para trocar, toque na sua foto.');
  });

  it('com sessão salva mostra "Bem-vindo de volta" e continua (sucesso)', async () => {
    mockServer({ employee: JOAO, since: '09:31' });
    renderWithToast(<EmployeeApp />);
    expect(await screen.findByRole('heading', { name: 'Bem-vindo de volta, João' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar como João' }));
    expect(await screen.findByRole('heading', { name: 'Meu dia de João' })).toBeInTheDocument();
  });

  it('erro ao entrar (funcionário desativado) mostra o motivo e recarrega a lista (erro)', async () => {
    mockServer({ employee: null, since: null });
    api.post.mockRejectedValue(new ApiError(403, 'Funcionário inativo.'));
    renderWithToast(<EmployeeApp />);
    await userEvent.click(await screen.findByRole('button', { name: /João S\./ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Funcionário inativo.');
    expect(screen.getByRole('heading', { name: 'Quem está trabalhando agora?' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/employees');
  });

  it('nenhum funcionário ativo mostra estado vazio (borda)', async () => {
    mockServer({ employee: null, since: null }, []);
    renderWithToast(<EmployeeApp />);
    expect(await screen.findByText('Nenhum funcionário ativo. Fale com o gestor.')).toBeInTheDocument();
  });

  it('aparelho perdeu autorização (401) recarrega a página para pedir o PIN (borda)', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    api.get.mockRejectedValue(new ApiError(401, 'Aparelho não autorizado.'));
    renderWithToast(<EmployeeApp />);
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });
});
