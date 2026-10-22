import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { HistoryPage } from '../../src/admin/HistoryPage';
import { renderWithToast } from '../helpers';
import { withAdmin } from './helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const ev = (id: number, o: object = {}) => ({
  id, date: '2026-10-21', dateLabel: 'Hoje', time: '10:52', checklistName: 'Abertura do restaurante', itemName: `Item ${id}`,
  employeeId: 'e1', employeeName: 'João Silva', initials: 'JS', color: '#C2502F', action: 'done', note: '', ...o,
});
const page = (rows: unknown[], total = rows.length, undone = 0) => ({ total, undone, rows });

function server(handler: (url: string) => unknown) {
  api.get.mockImplementation(async (url: string) => {
    if (url === '/api/admin/dates') return [{ value: '2026-10-21', label: 'Hoje · 21/10' }];
    if (url === '/api/admin/employees') return [{ id: 'e1', name: 'João Silva' }];
    return handler(url);
  });
}
const histUrls = () => api.get.mock.calls.map(([u]) => u as string).filter((u) => u.startsWith('/api/admin/history'));

beforeEach(() => vi.resetAllMocks());

describe('US17 — histórico (web)', () => {
  it('mostra contador e linhas; desmarcados destacados (sucesso)', async () => {
    server(() => page([ev(2, { action: 'undone', note: 'Contagem divergente.' }), ev(1)], 2, 1));
    renderWithToast(withAdmin(<HistoryPage />));
    expect(await screen.findByRole('heading', { name: 'Histórico de execução' })).toBeInTheDocument();
    expect(await screen.findByText('2 registros · 1 desmarcações')).toBeInTheDocument();
    const undone = screen.getByText('Item 2').closest('.table-row') as HTMLElement;
    expect(undone).toHaveClass('is-undone');
    expect(undone).toHaveTextContent('Hoje10:52Abertura do restauranteItem 2');
    expect(undone).toHaveTextContent('Desmarcado');
    expect(undone).toHaveTextContent('Contagem divergente.');
    expect(screen.getByText('Item 1').closest('.table-row')).toHaveTextContent('—');
  });

  it('"Mostrar mais registros" busca a próxima página e acrescenta (sucesso)', async () => {
    const first = Array.from({ length: 40 }, (_, i) => ev(100 - i));
    server((url) => (url.includes('offset=40') ? page([ev(1)], 41) : page(first, 41)));
    renderWithToast(withAdmin(<HistoryPage />));
    await userEvent.click(await screen.findByRole('button', { name: 'Mostrar mais registros' }));
    expect(await screen.findByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 100')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar mais registros' })).not.toBeInTheDocument();
  });

  it('filtros vão para a consulta e reiniciam a paginação (sucesso)', async () => {
    server(() => page([]));
    renderWithToast(withAdmin(<HistoryPage />));
    await screen.findByText('Nenhum registro encontrado com esses filtros.');
    await userEvent.selectOptions(await screen.findByLabelText('Ação'), 'undone');
    await userEvent.selectOptions(screen.getByLabelText('Funcionário'), 'e1');
    await userEvent.type(screen.getByPlaceholderText('Buscar item ou checklist…'), 'talher');
    await vi.waitFor(() => expect(histUrls().at(-1)).toBe('/api/admin/history?employeeId=e1&action=undone&q=talher'));
  });

  it('exatamente 40 registros não mostra "Mostrar mais" (borda)', async () => {
    server(() => page(Array.from({ length: 40 }, (_, i) => ev(i + 1)), 40));
    renderWithToast(withAdmin(<HistoryPage />));
    await screen.findByText('40 registros · 0 desmarcações');
    expect(screen.queryByRole('button', { name: 'Mostrar mais registros' })).not.toBeInTheDocument();
  });

  it('erro da API aparece (erro)', async () => {
    server(() => { throw new ApiError(422, 'Ação inválida.'); });
    renderWithToast(withAdmin(<HistoryPage />));
    expect(await screen.findByText('Ação inválida.')).toBeInTheDocument();
  });
});
