import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { AdminApp } from '../../src/admin/AdminApp';
import { MARINA, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));
vi.mock('../../src/admin/pages', () => ({
  PAGES: {
    dash: () => <h1>Página Painel</h1>, team: () => <h1>Página Equipe</h1>, items: () => <h1>Página Itens</h1>,
    cls: () => <h1>Página Checklists</h1>, hist: () => <h1>Página Histórico</h1>, guide: () => <h1>Página Passo a passo</h1>,
  },
}));

const type = async (digits: string) => {
  for (const d of digits) await userEvent.click(screen.getByRole('button', { name: d }));
};

beforeEach(() => vi.resetAllMocks());

describe('US11 — acesso do gestor (web)', () => {
  it('PIN correto libera o painel com toast (sucesso)', async () => {
    api.get.mockRejectedValueOnce(new ApiError(401, 'Acesso restrito ao gestor.')).mockResolvedValue({ manager: MARINA, lateToday: 3 });
    api.post.mockResolvedValue({ manager: MARINA });
    renderWithToast(<AdminApp />);
    expect(await screen.findByRole('heading', { name: 'Rastro · Painel do gestor' })).toBeInTheDocument();
    await type('1234');
    expect(api.post).toHaveBeenCalledWith('/api/admin/login', { pin: '1234' });
    expect(await screen.findByRole('heading', { name: 'Página Painel' })).toBeInTheDocument();
    expect(screen.getByText('Marina Alves')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Acesso liberado · Marina Alves');
  });

  it('PIN sem permissão mostra o erro (erro)', async () => {
    api.get.mockRejectedValue(new ApiError(401, 'Acesso restrito ao gestor.'));
    api.post.mockRejectedValue(new ApiError(401, 'PIN sem permissão de gestor.'));
    renderWithToast(<AdminApp />);
    await screen.findByRole('heading', { name: 'Rastro · Painel do gestor' });
    await type('9999');
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN sem permissão de gestor.');
  });

  it('sessão existente entra direto; badge mostra atrasos; navega entre páginas (sucesso)', async () => {
    api.get.mockResolvedValue({ manager: MARINA, lateToday: 3 });
    renderWithToast(<AdminApp />);
    const painel = await screen.findByRole('button', { name: /Painel/ });
    expect(painel).toHaveTextContent('3');
    expect(painel).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Itens' }));
    expect(screen.getByRole('heading', { name: 'Página Itens' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Itens' })).toHaveAttribute('aria-current', 'page');
  });

  it('sem atrasos não mostra badge (borda)', async () => {
    api.get.mockResolvedValue({ manager: MARINA, lateToday: 0 });
    renderWithToast(<AdminApp />);
    expect(await screen.findByRole('button', { name: 'Painel' })).toHaveTextContent(/^Painel$/);
  });

  it('Sair encerra a sessão e volta para a tela inicial (sucesso)', async () => {
    api.get.mockResolvedValue({ manager: MARINA, lateToday: 0 });
    api.del.mockResolvedValue(null);
    const go = vi.fn();
    renderWithToast(<AdminApp go={go} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(api.del).toHaveBeenCalledWith('/api/admin/login');
    expect(go).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('heading', { name: 'Rastro · Painel do gestor' })).not.toBeInTheDocument();
  });

  it('Sair com o servidor fora do ar ainda volta para a tela inicial (erro)', async () => {
    api.get.mockResolvedValue({ manager: MARINA, lateToday: 0 });
    api.del.mockRejectedValue(new ApiError(0, 'Sem conexão com o servidor.'));
    const go = vi.fn();
    renderWithToast(<AdminApp go={go} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    await vi.waitFor(() => expect(go).toHaveBeenCalledWith('/'));
  });

  it('menu tem "Passo a passo" que abre o assistente (sucesso)', async () => {
    api.get.mockResolvedValue({ manager: MARINA, lateToday: 0 });
    renderWithToast(<AdminApp />);
    await userEvent.click(await screen.findByRole('button', { name: 'Passo a passo' }));
    expect(await screen.findByRole('heading', { name: 'Página Passo a passo' })).toBeInTheDocument();
  });

  it('servidor fora do ar na verificação inicial mostra erro (borda)', async () => {
    api.get.mockRejectedValue(new ApiError(0, 'Sem conexão com o servidor.'));
    renderWithToast(<AdminApp />);
    expect(await screen.findByText('Sem conexão com o servidor.')).toBeInTheDocument();
  });
});
