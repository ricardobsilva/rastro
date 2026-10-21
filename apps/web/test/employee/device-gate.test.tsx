import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { DeviceGate } from '../../src/employee/DeviceGate';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const type = async (digits: string) => {
  for (const d of digits) await userEvent.click(screen.getByRole('button', { name: d }));
};

beforeEach(() => vi.resetAllMocks());

describe('US01 — DeviceGate', () => {
  it('aparelho já autorizado mostra o conteúdo direto (sucesso)', async () => {
    api.get.mockResolvedValue({ authorized: true });
    render(<DeviceGate><p>conteúdo</p></DeviceGate>);
    expect(await screen.findByText('conteúdo')).toBeInTheDocument();
  });

  it('aparelho novo pede o PIN do gestor e libera ao acertar (sucesso)', async () => {
    api.get.mockResolvedValue({ authorized: false });
    api.post.mockResolvedValue({ authorized: true });
    render(<DeviceGate><p>conteúdo</p></DeviceGate>);
    expect(await screen.findByRole('heading', { name: 'Liberar este aparelho' })).toBeInTheDocument();
    await type('1234');
    expect(api.post).toHaveBeenCalledWith('/api/device/authorize', { pin: '1234' });
    expect(await screen.findByText('conteúdo')).toBeInTheDocument();
  });

  it('PIN sem permissão mostra a mensagem da API (erro)', async () => {
    api.get.mockResolvedValue({ authorized: false });
    api.post.mockRejectedValue(new ApiError(401, 'PIN sem permissão de gestor.'));
    render(<DeviceGate><p>conteúdo</p></DeviceGate>);
    await screen.findByRole('heading', { name: 'Liberar este aparelho' });
    await type('9999');
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN sem permissão de gestor.');
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('bloqueio por tentativas mostra a mensagem de espera (borda)', async () => {
    api.get.mockResolvedValue({ authorized: false });
    api.post.mockRejectedValue(new ApiError(429, 'Muitas tentativas. Tente novamente em alguns minutos.'));
    render(<DeviceGate><p>conteúdo</p></DeviceGate>);
    await screen.findByRole('heading', { name: 'Liberar este aparelho' });
    await type('1234');
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas');
  });

  it('falha de rede ao verificar mostra erro com opção de tentar de novo (borda)', async () => {
    api.get.mockRejectedValueOnce(new ApiError(0, 'Sem conexão com o servidor.')).mockResolvedValueOnce({ authorized: true });
    render(<DeviceGate><p>conteúdo</p></DeviceGate>);
    expect(await screen.findByText('Sem conexão com o servidor.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('conteúdo')).toBeInTheDocument();
  });
});
