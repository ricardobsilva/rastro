import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { RunScreen } from '../../src/employee/RunScreen';
import { JOAO, execution, item, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const renderRun = (props: Partial<Parameters<typeof RunScreen>[0]> = {}) =>
  renderWithToast(<RunScreen executionId={7} me={JOAO} onBack={vi.fn()} onSwitch={vi.fn()} onFinished={vi.fn()} {...props} />);

const card = (name: string) => screen.getByText(name).closest('.exec-item') as HTMLElement;

beforeEach(() => vi.resetAllMocks());

describe('US04 — execução do checklist', () => {
  it('mostra cabeçalho, contador e chips dos itens (sucesso)', async () => {
    api.get.mockResolvedValue(execution());
    renderRun();
    expect(await screen.findByRole('heading', { name: 'Abertura do restaurante' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/me/executions/7');
    expect(screen.getByText('Concluir até 10:30')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(within(card('Conferir organização das mesas')).getByText('João · 10:12')).toBeInTheDocument();
    expect(within(card('Conferir organização das mesas')).getByText('Obrigatório')).toBeInTheDocument();
    expect(within(card('Conferir talheres')).getByText('Desmarcado às 10:52 · registrado no histórico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /João · Trocar/ })).toBeInTheDocument();
  });

  it('marcar envia done=true e atualiza com a resposta (sucesso)', async () => {
    api.get.mockResolvedValue(execution());
    api.put.mockResolvedValue(execution({ done: 2, items: [item({ status: 'done', doneAt: '10:12' }), item({ itemId: 'i2', name: 'Verificar guardanapos', status: 'done', doneAt: '11:01' }), item({ itemId: 'i3', name: 'Conferir talheres' })] }));
    renderRun();
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar Verificar guardanapos' }));
    expect(api.put).toHaveBeenCalledWith('/api/me/executions/7/items/i2', { done: true });
    expect(await screen.findByText('2/3')).toBeInTheDocument();
    expect(within(card('Verificar guardanapos')).getByText('João · 11:01')).toBeInTheDocument();
  });

  it('desmarcar avisa que ficou registrado no histórico (sucesso)', async () => {
    api.get.mockResolvedValue(execution());
    api.put.mockResolvedValue(execution({ done: 0, items: [item({ undoneAt: '11:05' })] }));
    renderRun();
    await userEvent.click(await screen.findByRole('button', { name: 'Desmarcar Conferir organização das mesas' }));
    expect(api.put).toHaveBeenCalledWith('/api/me/executions/7/items/i1', { done: false });
    expect(await screen.findByRole('status')).toHaveTextContent('Item desmarcado. A alteração foi registrada no histórico.');
    expect(screen.getByRole('status')).toHaveAttribute('data-kind', 'warn');
  });

  it('erro ao marcar mostra o motivo e mantém o estado (erro)', async () => {
    api.get.mockResolvedValue(execution());
    api.put.mockRejectedValue(new ApiError(409, 'Este checklist é de um dia anterior.'));
    renderRun();
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar Verificar guardanapos' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Este checklist é de um dia anterior.');
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('checklist inexistente mostra erro e volta (erro)', async () => {
    api.get.mockRejectedValue(new ApiError(404, 'Checklist não encontrado.'));
    const onBack = vi.fn();
    renderRun({ onBack });
    expect(await screen.findByText('Checklist não encontrado.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '← Meu dia' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('itens atrasados mostram chip e o cabeçalho avisa o atraso (borda)', async () => {
    api.get.mockResolvedValue(execution({ status: 'late', items: [item({ status: 'late' })], done: 0, total: 1 }));
    renderRun();
    expect(await screen.findByText('Concluir até 10:30 · com atraso')).toBeInTheDocument();
    expect(within(card('Conferir organização das mesas')).getByText('Atrasado')).toBeInTheDocument();
  });

  it('cliques repetidos enquanto salva enviam uma só requisição (borda)', async () => {
    api.get.mockResolvedValue(execution());
    let resolve!: (v: unknown) => void;
    api.put.mockReturnValue(new Promise((r) => (resolve = r)));
    renderRun();
    const btn = await screen.findByRole('button', { name: 'Marcar Verificar guardanapos' });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(api.put).toHaveBeenCalledTimes(1);
    resolve(execution());
  });

  it('checklist sob demanda mostra "Sob demanda" no cabeçalho (borda)', async () => {
    api.get.mockResolvedValue(execution({ dueTime: null }));
    renderRun();
    expect(await screen.findByText('Sob demanda')).toBeInTheDocument();
  });
});
