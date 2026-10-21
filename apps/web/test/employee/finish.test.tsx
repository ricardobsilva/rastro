import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { RunScreen } from '../../src/employee/RunScreen';
import { JOAO, execution, item, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const renderRun = (onFinished = vi.fn()) =>
  renderWithToast(<RunScreen executionId={7} me={JOAO} onBack={vi.fn()} onSwitch={vi.fn()} onFinished={onFinished} />);

beforeEach(() => vi.resetAllMocks());

describe('US06 — concluir checklist (web)', () => {
  it('opcionais pendentes: salva, avisa e volta ao Meu dia (sucesso)', async () => {
    api.get.mockResolvedValue(execution());
    api.post.mockResolvedValue({ pending: 2, kind: 'warn', message: 'Checklist salvo. 2 itens continuam pendentes.' });
    const onFinished = vi.fn();
    renderRun(onFinished);
    await userEvent.click(await screen.findByRole('button', { name: 'Concluir checklist' }));
    expect(api.post).toHaveBeenCalledWith('/api/me/executions/7/finish');
    expect(onFinished).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Checklist salvo. 2 itens continuam pendentes.');
    expect(screen.getByRole('status')).toHaveAttribute('data-kind', 'warn');
  });

  it('obrigatório pendente mostra o banner de erro e fica na tela (erro)', async () => {
    api.get.mockResolvedValue(execution());
    api.post.mockRejectedValue(new ApiError(422, 'Falta 1 item obrigatório: Conferir talheres.'));
    const onFinished = vi.fn();
    renderRun(onFinished);
    await userEvent.click(await screen.findByRole('button', { name: 'Concluir checklist' }));
    expect(await screen.findByText('Falta 1 item obrigatório: Conferir talheres.')).toBeInTheDocument();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('marcar um item limpa o banner de erro (borda)', async () => {
    api.get.mockResolvedValue(execution());
    api.post.mockRejectedValue(new ApiError(422, 'Falta 1 item obrigatório: Conferir talheres.'));
    api.put.mockResolvedValue(execution());
    renderRun();
    await userEvent.click(await screen.findByRole('button', { name: 'Concluir checklist' }));
    await screen.findByText('Falta 1 item obrigatório: Conferir talheres.');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar Verificar guardanapos' }));
    expect(screen.queryByText('Falta 1 item obrigatório: Conferir talheres.')).not.toBeInTheDocument();
  });

  it('100% mostra banner de sucesso e "Voltar para Meu dia" sem chamar a API (borda)', async () => {
    api.get.mockResolvedValue(execution({ done: 1, total: 1, status: 'done', items: [item({ status: 'done', doneAt: '10:00' })] }));
    const onFinished = vi.fn();
    renderRun(onFinished);
    expect(await screen.findByText('Checklist concluído')).toBeInTheDocument();
    expect(screen.getByText('Tudo registrado em seu nome. Bom trabalho!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para Meu dia' }));
    expect(api.post).not.toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalled();
  });
});
