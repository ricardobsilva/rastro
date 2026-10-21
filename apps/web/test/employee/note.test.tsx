import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { RunScreen } from '../../src/employee/RunScreen';
import { JOAO, execution, item, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const withNote = (note = '') => execution({ items: [item({ itemId: 'i5', name: 'Conferir arroz', allowNote: true, note })], total: 1, done: 0 });
const renderRun = () => renderWithToast(<RunScreen executionId={7} me={JOAO} onBack={vi.fn()} onSwitch={vi.fn()} onFinished={vi.fn()} />);

beforeEach(() => vi.resetAllMocks());

describe('US05 — observações (web)', () => {
  it('adiciona observação e mostra entre aspas (sucesso)', async () => {
    api.get.mockResolvedValue(withNote());
    api.put.mockResolvedValue(withNote('Restam 3 sacos.'));
    renderRun();
    await userEvent.click(await screen.findByRole('button', { name: '+ Adicionar observação' }));
    await userEvent.type(screen.getByPlaceholderText('Ex.: faltaram 2 toalhas, avisei a gerência'), 'Restam 3 sacos.');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar observação' }));
    expect(api.put).toHaveBeenCalledWith('/api/me/executions/7/items/i5/note', { note: 'Restam 3 sacos.' });
    expect(await screen.findByText('“Restam 3 sacos.”')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Observação salva.');
    expect(screen.getByRole('button', { name: '+ Editar observação' })).toBeInTheDocument();
  });

  it('editar abre o texto atual para alteração (sucesso)', async () => {
    api.get.mockResolvedValue(withNote('v1'));
    renderRun();
    await userEvent.click(await screen.findByRole('button', { name: '+ Editar observação' }));
    expect(screen.getByRole('textbox')).toHaveValue('v1');
  });

  it('erro ao salvar mantém o formulário aberto com o texto (erro)', async () => {
    api.get.mockResolvedValue(withNote());
    api.put.mockRejectedValue(new ApiError(422, 'A observação pode ter até 500 caracteres.'));
    renderRun();
    await userEvent.click(await screen.findByRole('button', { name: '+ Adicionar observação' }));
    await userEvent.type(screen.getByRole('textbox'), 'texto');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar observação' }));
    expect(await screen.findByRole('status')).toHaveTextContent('A observação pode ter até 500 caracteres.');
    expect(screen.getByRole('textbox')).toHaveValue('texto');
  });

  it('cancelar fecha sem salvar (borda)', async () => {
    api.get.mockResolvedValue(withNote());
    renderRun();
    await userEvent.click(await screen.findByRole('button', { name: '+ Adicionar observação' }));
    await userEvent.type(screen.getByRole('textbox'), 'rascunho');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('salvar vazio limpa sem o toast de "salva" (borda)', async () => {
    api.get.mockResolvedValue(withNote('antiga'));
    api.put.mockResolvedValue(withNote(''));
    renderRun();
    await userEvent.click(await screen.findByRole('button', { name: '+ Editar observação' }));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar observação' }));
    expect(api.put).toHaveBeenCalledWith('/api/me/executions/7/items/i5/note', { note: '' });
    expect(screen.queryByText('“antiga”')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).not.toHaveTextContent('Observação salva.');
  });

  it('item sem permissão não mostra o botão (borda)', async () => {
    api.get.mockResolvedValue(execution());
    renderRun();
    const card = (await screen.findByText('Verificar guardanapos')).closest('.exec-item') as HTMLElement;
    expect(within(card).queryByRole('button', { name: /observação/ })).not.toBeInTheDocument();
  });
});
