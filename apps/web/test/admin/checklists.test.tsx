import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { ChecklistsPage } from '../../src/admin/ChecklistsPage';
import { renderWithToast } from '../helpers';
import { withAdmin } from './helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const it_ = (id: string, name: string, o: object = {}) => ({ id, name, description: '', category: 'Limpeza', required: false, allowNote: false, active: true, usedIn: [], ...o });
const ITEMS = [it_('i1', 'Conferir mesas', { required: true }), it_('i2', 'Verificar guardanapos'), it_('i3', 'Conferir talheres'), it_('i9', 'Validade dos perecíveis'), it_('i24', 'Abastecer limpeza', { active: false })];
const emp = (id: string, name: string, group: string, active = true) => ({ id, name, firstName: name.split(' ')[0], shortName: name, initials: 'XX', role: 'r', group, color: '#000', active, hasPin: false, isManager: false });
const EMPS = [emp('e1', 'João Silva', 'Salão'), emp('e2', 'Ana Costa', 'Salão'), emp('e5', 'Rafael Lima', 'Bar'), emp('e8', 'Paula Nunes', 'Salão', false)];
const CL = (o: object = {}) => ({ id: 'c1', name: 'Abertura do restaurante', description: 'Antes de abrir.', period: 'daily', days: [], dueTime: '10:30', roles: ['Salão'], employeeIds: [], itemIds: ['i1', 'i2', 'i3'], active: true, assignees: ['João Silva', 'Ana Costa'], ...o });
const CLS = [CL(), CL({ id: 'c8', name: 'Limpeza da coifa', period: 'weekly', days: [3], dueTime: '15:00', roles: [], employeeIds: ['e5'], itemIds: ['i1'], assignees: ['Rafael Lima'] })];

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation(async (url: string) => ({ '/api/admin/checklists': CLS, '/api/admin/items': ITEMS, '/api/admin/employees': EMPS })[url]);
});
const render = () => renderWithToast(withAdmin(<ChecklistsPage />));
const rows = () => screen.getAllByTestId('cl-item-row').map((r) => within(r).getByTestId('cl-item-name').textContent);

describe('US14 — checklists (web)', () => {
  it('lista e abre o primeiro no editor, com responsáveis resolvidos (sucesso)', async () => {
    render();
    const list = await screen.findByRole('list', { name: 'Checklists' });
    expect(within(list).getByText('Todos os dias · até 10:30 · 3 itens')).toBeInTheDocument();
    expect(within(list).getByText('Semanal · quarta-feira · até 15:00 · 1 item')).toBeInTheDocument();
    expect(within(list).getByText('João, Ana')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Editar checklist' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do checklist')).toHaveValue('Abertura do restaurante');
    expect(screen.getByText('Aparecerá no “Meu dia” de: João Silva, Ana Costa.')).toBeInTheDocument();
    expect(rows()).toEqual(['Conferir mesas', 'Verificar guardanapos', 'Conferir talheres']);
  });

  it('reordena com ↑ ↓, remove com × e adiciona da biblioteca; salva com PUT (sucesso)', async () => {
    api.put.mockResolvedValue(CL({ itemIds: ['i2', 'i1', 'i9'] }));
    render();
    await screen.findByRole('heading', { name: 'Editar checklist' });
    await userEvent.click(screen.getAllByRole('button', { name: 'Subir' })[1]!);
    expect(rows()).toEqual(['Verificar guardanapos', 'Conferir mesas', 'Conferir talheres']);
    await userEvent.click(screen.getAllByRole('button', { name: 'Remover' })[2]!);
    const lib = screen.getByRole('region', { name: 'Adicionar da biblioteca' });
    expect(within(lib).queryByText('Abastecer limpeza')).not.toBeInTheDocument();
    expect(within(lib).queryByText('Conferir mesas')).not.toBeInTheDocument();
    await userEvent.type(within(lib).getByPlaceholderText('Buscar item…'), 'valid');
    await userEvent.click(within(lib).getByRole('button', { name: /Validade dos perecíveis/ }));
    expect(rows()).toEqual(['Verificar guardanapos', 'Conferir mesas', 'Validade dos perecíveis']);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar checklist' }));
    expect(api.put).toHaveBeenCalledWith('/api/admin/checklists/c1', expect.objectContaining({ itemIds: ['i2', 'i1', 'i9'], roles: ['Salão'] }));
    expect(await screen.findByRole('status')).toHaveTextContent('Checklist atualizado. O histórico anterior foi preservado.');
  });

  it('arrastar e soltar reordena (sucesso)', async () => {
    render();
    await screen.findByRole('heading', { name: 'Editar checklist' });
    const [first, , third] = screen.getAllByTestId('cl-item-row');
    fireEvent.dragStart(first!, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.dragOver(third!);
    fireEvent.drop(third!);
    expect(rows()).toEqual(['Verificar guardanapos', 'Conferir talheres', 'Conferir mesas']);
  });

  it('erro de validação do servidor aparece no editor (erro)', async () => {
    api.put.mockRejectedValue(new ApiError(422, 'Associe pelo menos uma função ou pessoa.'));
    render();
    await screen.findByRole('heading', { name: 'Editar checklist' });
    await userEvent.click(screen.getByRole('button', { name: 'Salão' }));
    expect(screen.getByText('Ninguém receberá este checklist ainda.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar checklist' }));
    expect(await screen.findByText('Associe pelo menos uma função ou pessoa.')).toBeInTheDocument();
  });

  it('novo checklist: POST com periodicidade e dias; semanal mantém um só dia (sucesso/borda)', async () => {
    api.post.mockResolvedValue(CL({ id: 'c_new', name: 'Conferência da adega' }));
    render();
    await userEvent.click(await screen.findByRole('button', { name: '+ Criar checklist' }));
    expect(screen.getByRole('heading', { name: 'Novo checklist' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nome do checklist'), 'Conferência da adega');
    await userEvent.click(screen.getByRole('button', { name: 'Dias específicos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Seg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Qui' }));
    await userEvent.click(screen.getByRole('button', { name: 'Semanalmente' }));
    expect(screen.getByRole('button', { name: 'Seg' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Qui' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Qui' }));
    expect(screen.getByRole('button', { name: 'Seg' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Rafael' }));
    await userEvent.click(within(screen.getByRole('region', { name: 'Adicionar da biblioteca' })).getByRole('button', { name: /Validade/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar checklist' }));
    expect(api.post).toHaveBeenCalledWith('/api/admin/checklists', expect.objectContaining({
      name: 'Conferência da adega', period: 'weekly', days: [4], employeeIds: ['e5'], itemIds: ['i9'], dueTime: '12:00',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Checklist criado e atribuído à equipe.');
  });

  it('sob demanda esconde dias e horário; inativos não aparecem como pessoas (borda)', async () => {
    render();
    await screen.findByRole('heading', { name: 'Editar checklist' });
    expect(screen.queryByRole('button', { name: 'Paula' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sob demanda' }));
    expect(screen.queryByLabelText('Concluir até')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seg' })).not.toBeInTheDocument();
  });

  it('descartar volta ao que estava salvo; ↑ no primeiro é ignorado (borda)', async () => {
    render();
    await screen.findByRole('heading', { name: 'Editar checklist' });
    await userEvent.click(screen.getAllByRole('button', { name: 'Subir' })[0]!);
    expect(rows()[0]).toBe('Conferir mesas');
    await userEvent.clear(screen.getByLabelText('Nome do checklist'));
    await userEvent.type(screen.getByLabelText('Nome do checklist'), 'Rascunho');
    await userEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }));
    expect(screen.getByLabelText('Nome do checklist')).toHaveValue('Abertura do restaurante');
  });

  it('sem itens mostra orientação (borda)', async () => {
    render();
    await screen.findByRole('heading', { name: 'Editar checklist' });
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getAllByRole('button', { name: 'Remover' })[0]!);
    expect(screen.getByText('Adicione itens da biblioteca ao lado.')).toBeInTheDocument();
  });
});
