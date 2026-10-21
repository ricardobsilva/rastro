import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { EmployeeApp } from '../../src/employee/EmployeeApp';
import { ANA, EMPLOYEES, JOAO, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));
vi.mock('../../src/employee/TodayScreen', () => ({
  TodayScreen: ({ me, onSwitch }: { me: { firstName: string }; onSwitch: () => void }) => (
    <><h1>Meu dia de {me.firstName}</h1><button onClick={onSwitch}>Trocar ⇄</button></>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation(async (url: string) => (url === '/api/session' ? { employee: JOAO, since: '09:31' } : EMPLOYEES));
});

async function openSheet() {
  renderWithToast(<EmployeeApp />);
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar como João' }));
  await userEvent.click(screen.getByRole('button', { name: 'Trocar ⇄' }));
  return screen.findByRole('dialog', { name: 'Quem vai usar agora?' });
}

describe('US09 — troca rápida (web)', () => {
  it('um toque troca a pessoa e mostra o toast (sucesso)', async () => {
    api.post.mockResolvedValue({ employee: ANA, since: '11:00' });
    const sheet = await openSheet();
    expect(within(sheet).getByRole('button', { name: /João S\..*Usando agora/ })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: /Ana C\./ }));
    expect(api.post).toHaveBeenCalledWith('/api/session', { employeeId: 'e2' });
    expect(await screen.findByRole('heading', { name: 'Meu dia de Ana' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Olá, Ana! Para trocar, toque na sua foto.');
  });

  it('falha na troca mantém o usuário atual (erro)', async () => {
    api.post.mockRejectedValue(new ApiError(403, 'Funcionário inativo.'));
    const sheet = await openSheet();
    await userEvent.click(within(sheet).getByRole('button', { name: /Ana C\./ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Funcionário inativo.');
    expect(screen.getByRole('heading', { name: 'Meu dia de João' })).toBeInTheDocument();
  });

  it('tocar em si mesmo só fecha, sem novo login (borda)', async () => {
    const sheet = await openSheet();
    await userEvent.click(within(sheet).getByRole('button', { name: /João S\./ }));
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tocar fora (overlay) fecha a folha (borda)', async () => {
    await openSheet();
    await userEvent.click(screen.getByTestId('sheet-overlay'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Não é o João? Trocar usuário" na tela de retorno abre a folha (sucesso)', async () => {
    renderWithToast(<EmployeeApp />);
    await userEvent.click(await screen.findByRole('button', { name: 'Não é o João? Trocar usuário' }));
    expect(await screen.findByRole('dialog', { name: 'Quem vai usar agora?' })).toBeInTheDocument();
  });
});
