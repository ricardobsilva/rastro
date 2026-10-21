import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { EmployeeModal } from '../../src/admin/EmployeeModal';
import { renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const JOAO_ADMIN = { id: 'e1', name: 'João Silva', role: 'Garçom', group: 'Salão', hasPin: false };

beforeEach(() => vi.resetAllMocks());

describe('US13 — modal de funcionário', () => {
  it('cadastra funcionário sem PIN (sucesso)', async () => {
    const onSaved = vi.fn();
    api.post.mockResolvedValue({ id: 'e_1', name: 'Lucas Pereira' });
    renderWithToast(<EmployeeModal onClose={vi.fn()} onSaved={onSaved} />);
    expect(screen.getByRole('dialog', { name: 'Novo funcionário' })).toBeInTheDocument();
    expect(screen.queryByLabelText('PIN de 4 dígitos')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Lucas Pereira');
    await userEvent.type(screen.getByLabelText('Cargo'), 'Garçom');
    await userEvent.click(screen.getByRole('button', { name: 'Bar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(api.post).toHaveBeenCalledWith('/api/admin/employees', { name: 'Lucas Pereira', role: 'Garçom', group: 'Bar' });
    expect(onSaved).toHaveBeenCalledWith({ id: 'e_1', name: 'Lucas Pereira' });
    expect(screen.getByRole('status')).toHaveTextContent('Funcionário cadastrado.');
  });

  it('Gerência pede PIN, que só aceita números (sucesso/borda)', async () => {
    api.post.mockResolvedValue({ id: 'e_2' });
    renderWithToast(<EmployeeModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Rita');
    await userEvent.type(screen.getByLabelText('Cargo'), 'Sub');
    await userEvent.click(screen.getByRole('button', { name: 'Gerência' }));
    await userEvent.type(screen.getByLabelText('PIN de 4 dígitos'), '4a32109');
    expect(screen.getByLabelText('PIN de 4 dígitos')).toHaveValue('4321');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(api.post).toHaveBeenCalledWith('/api/admin/employees', { name: 'Rita', role: 'Sub', group: 'Gerência', pin: '4321' });
  });

  it('nome/cargo vazios validam no modal; erro da API aparece no topo (erro)', async () => {
    api.post.mockRejectedValue(new ApiError(409, 'Esse PIN já está em uso.'));
    renderWithToast(<EmployeeModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha nome e cargo.');
    expect(api.post).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Rita');
    await userEvent.type(screen.getByLabelText('Cargo'), 'Sub');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse PIN já está em uso.');
  });

  it('editar gestor com PIN existente: PIN em branco mantém o atual (borda)', async () => {
    api.patch.mockResolvedValue({ id: 'e6' });
    renderWithToast(<EmployeeModal employee={{ id: 'e6', name: 'Marina Alves', role: 'Gerente', group: 'Gerência', hasPin: true }} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Editar funcionário' })).toBeInTheDocument();
    expect(screen.getByLabelText('PIN de 4 dígitos')).toHaveAttribute('placeholder', '•••• (manter)');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(api.patch).toHaveBeenCalledWith('/api/admin/employees/e6', { name: 'Marina Alves', role: 'Gerente', group: 'Gerência' });
    expect(screen.getByRole('status')).toHaveTextContent('Funcionário atualizado.');
  });

  it('editar funcionário comum vem preenchido (sucesso)', () => {
    renderWithToast(<EmployeeModal employee={JOAO_ADMIN} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText('Nome completo')).toHaveValue('João Silva');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salão' })).toHaveAttribute('aria-pressed', 'true');
  });
});
