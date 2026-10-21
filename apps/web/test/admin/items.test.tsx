import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { ItemsPage } from '../../src/admin/ItemsPage';
import { renderWithToast } from '../helpers';
import { withAdmin } from './helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const ITEMS = [
  { id: 'i3', name: 'Conferir talheres', description: 'Talheres limpos.', category: 'Atendimento', required: true, allowNote: true, active: true, usedIn: ['Abertura do restaurante'] },
  { id: 'i4', name: 'Verificar limpeza do salão', description: '', category: 'Limpeza', required: false, allowNote: false, active: true, usedIn: ['A', 'B'] },
  { id: 'i24', name: 'Abastecer produtos de limpeza', description: '', category: 'Estoque', required: false, allowNote: false, active: false, usedIn: [] },
];
const row = (name: string) => screen.getByText(name).closest('.table-row') as HTMLElement;
const render = () => renderWithToast(withAdmin(<ItemsPage />));

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue(ITEMS);
});

describe('US12 — itens (web)', () => {
  it('lista com categoria, obrigatório, observação, uso e status (sucesso)', async () => {
    render();
    expect(await screen.findByRole('heading', { name: 'Itens de checklist' })).toBeInTheDocument();
    const r = row('Conferir talheres');
    expect(r).toHaveTextContent('Atendimento');
    expect(r).toHaveTextContent('Sim');
    expect(r).toHaveTextContent('Permite');
    expect(r).toHaveTextContent('1 checklist');
    expect(within(row('Verificar limpeza do salão')).getByText('2 checklists')).toHaveAttribute('title', 'A, B');
    expect(row('Verificar limpeza do salão')).toHaveTextContent('Sem descrição');
    expect(row('Abastecer produtos de limpeza')).toHaveTextContent('Não utilizado');
    expect(within(row('Abastecer produtos de limpeza')).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('busca e filtro por categoria; sem resultado mostra vazio (borda)', async () => {
    render();
    await screen.findByText('Conferir talheres');
    await userEvent.type(screen.getByPlaceholderText('Buscar item…'), 'limpeza');
    expect(screen.queryByText('Conferir talheres')).not.toBeInTheDocument();
    expect(screen.getByText('Verificar limpeza do salão')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Estoque' }));
    expect(screen.queryByText('Verificar limpeza do salão')).not.toBeInTheDocument();
    expect(screen.getByText('Abastecer produtos de limpeza')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cozinha' }));
    expect(screen.getByText('Nenhum item encontrado.')).toBeInTheDocument();
  });

  it('cria item pelo modal (sucesso)', async () => {
    api.post.mockResolvedValue({ id: 'i_x', name: 'Conferir carvão', description: '', category: 'Estoque', required: true, allowNote: false, active: true, usedIn: [] });
    render();
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo item' }));
    const modal = screen.getByRole('dialog', { name: 'Novo item' });
    await userEvent.type(within(modal).getByLabelText('Nome do item *'), 'Conferir carvão');
    await userEvent.click(within(modal).getByRole('button', { name: 'Estoque' }));
    await userEvent.click(within(modal).getByRole('switch', { name: /Obrigatório/ }));
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar item' }));
    expect(api.post).toHaveBeenCalledWith('/api/admin/items', { name: 'Conferir carvão', description: '', category: 'Estoque', required: true, allowNote: false, active: true });
    expect(await screen.findByText('Conferir carvão')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Item cadastrado. Já pode ser usado em qualquer checklist.');
  });

  it('nome vazio valida no próprio modal; duplicado mostra erro da API (erro)', async () => {
    api.post.mockRejectedValue(new ApiError(409, 'Já existe um item com esse nome.'));
    render();
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo item' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    expect(screen.getByText('Informe o nome do item.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Nome do item *'), 'Conferir talheres');
    expect(screen.queryByText('Informe o nome do item.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    expect(await screen.findByText('Já existe um item com esse nome.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do item *')).toHaveAttribute('aria-invalid', 'true');
  });

  it('editar abre preenchido e salva com PATCH (sucesso)', async () => {
    api.patch.mockResolvedValue({ ...ITEMS[0], name: 'Conferir talheres e pratos' });
    render();
    await userEvent.click(within(await screen.findByText('Conferir talheres').then((n) => n.closest('.table-row') as HTMLElement)).getByRole('button', { name: 'Editar' }));
    const name = screen.getByLabelText('Nome do item *');
    expect(name).toHaveValue('Conferir talheres');
    await userEvent.type(name, ' e pratos');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar item' }));
    expect(api.patch).toHaveBeenCalledWith('/api/admin/items/i3', expect.objectContaining({ name: 'Conferir talheres e pratos' }));
    expect(await screen.findByText('Conferir talheres e pratos')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Item atualizado.');
  });

  it('switch desativa com aviso (sucesso) e overlay fecha o modal (borda)', async () => {
    api.patch.mockResolvedValue({ ...ITEMS[0], active: false });
    render();
    await userEvent.click(within(await screen.findByText('Conferir talheres').then((n) => n.closest('.table-row') as HTMLElement)).getByRole('switch'));
    expect(api.patch).toHaveBeenCalledWith('/api/admin/items/i3', { active: false });
    expect(await screen.findByRole('status')).toHaveTextContent('Item desativado. Ele deixa de aparecer nos checklists a partir de hoje.');
    await userEvent.click(screen.getByRole('button', { name: '+ Novo item' }));
    await userEvent.click(screen.getByTestId('modal-overlay'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
