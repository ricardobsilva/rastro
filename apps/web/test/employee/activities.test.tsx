import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { ActivitiesScreen } from '../../src/employee/ActivitiesScreen';
import { ProfileScreen } from '../../src/employee/ProfileScreen';
import { JOAO, renderWithToast } from '../helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

beforeEach(() => vi.resetAllMocks());

describe('US08 — Atividades', () => {
  it('lista hora, item, checklist e chip da ação (sucesso)', async () => {
    api.get.mockResolvedValue([
      { id: 3, time: '10:52', itemName: 'Conferir talheres', checklistName: 'Abertura do restaurante', action: 'undone', note: '' },
      { id: 2, time: '10:20', itemName: 'Conferir arroz', checklistName: 'Abertura do restaurante', action: 'note', note: 'ok' },
      { id: 1, time: '09:52', itemName: 'Conferir mesas', checklistName: 'Abertura do restaurante', action: 'done', note: '' },
    ]);
    renderWithToast(<ActivitiesScreen />);
    expect(await screen.findByRole('heading', { name: 'Minhas atividades' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('10:52Conferir talheresAbertura do restauranteDesmarcado');
    expect(rows[1]).toHaveTextContent('Observação');
    expect(rows[2]).toHaveTextContent('Concluído');
  });

  it('erro ao carregar (erro)', async () => {
    api.get.mockRejectedValue(new ApiError(500, 'Erro interno.'));
    renderWithToast(<ActivitiesScreen />);
    expect(await screen.findByText('Erro interno.')).toBeInTheDocument();
  });

  it('vazio (borda)', async () => {
    api.get.mockResolvedValue([]);
    renderWithToast(<ActivitiesScreen />);
    expect(await screen.findByText('Você ainda não concluiu tarefas hoje.')).toBeInTheDocument();
  });
});

describe('US08 — Perfil', () => {
  it('mostra dados e a sessão; botões chamam as ações (sucesso)', async () => {
    const onSwitch = vi.fn();
    const onLogout = vi.fn();
    renderWithToast(<ProfileScreen me={JOAO} since="09:31" onSwitch={onSwitch} onLogout={onLogout} />);
    expect(screen.getByRole('heading', { name: 'João Silva' })).toBeInTheDocument();
    expect(screen.getByText('Garçom · Salão')).toBeInTheDocument();
    expect(screen.getByText(/Identificado desde as 09:31/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trocar usuário' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sair deste aparelho' }));
    expect(onSwitch).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
  });

  it('sem horário de sessão não quebra (borda)', () => {
    renderWithToast(<ProfileScreen me={JOAO} since={null} onSwitch={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getByText(/Todas as marcações são registradas em seu nome/)).toBeInTheDocument();
  });
});
