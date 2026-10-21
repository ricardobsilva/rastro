import { render, screen } from '@testing-library/react';
import { App } from '../src/App';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

beforeEach(() => vi.resetAllMocks());

describe('App — rotas', () => {
  it('aparelho novo cai na liberação de aparelho (sucesso)', async () => {
    api.get.mockResolvedValue({ authorized: false });
    render(<App path="/" />);
    expect(await screen.findByRole('heading', { name: 'Liberar este aparelho' })).toBeInTheDocument();
  });

  it('/estacao abre o modo estação de trabalho (sucesso)', async () => {
    api.get.mockImplementation(async (url: string) => {
      if (url === '/api/device') return { authorized: true };
      if (url === '/api/session') return { employee: null, since: null };
      return { now: '10:00', dateLabel: 'quarta-feira, 21 de outubro', members: [] };
    });
    render(<App path="/estacao" />);
    expect(await screen.findByRole('heading', { name: 'Quem vai marcar tarefas agora?' })).toBeInTheDocument();
  });

  it('caminho desconhecido cai no modo celular (borda)', async () => {
    api.get.mockImplementation(async (url: string) => {
      if (url === '/api/device') return { authorized: true };
      if (url === '/api/session') return { employee: null, since: null };
      return [];
    });
    render(<App path="/qualquer" />);
    expect(await screen.findByRole('heading', { name: 'Quem está trabalhando agora?' })).toBeInTheDocument();
  });
});
