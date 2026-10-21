import { render, screen } from '@testing-library/react';
import { App } from '../src/App';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

describe('App', () => {
  it('aparelho novo cai na liberação de aparelho (sucesso)', async () => {
    api.get.mockResolvedValue({ authorized: false });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Liberar este aparelho' })).toBeInTheDocument();
  });
});
