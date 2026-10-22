import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { DataPage } from '../../src/admin/DataPage';
import { renderWithToast } from '../helpers';
import { withAdmin } from './helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));
const EXPORT = {
  format: 'rastro-export', version: 1, exportedAt: '2026-10-21T14:40:00.000Z',
  tables: {
    employees: rows(8), items: rows(26), checklists: rows(11), checklist_items: rows(40), checklist_roles: rows(5),
    checklist_employees: rows(6), executions: rows(20), execution_items: rows(90), audit_events: rows(34),
  },
};
const fileOf = (content: unknown, name = 'rastro-dados-2026-10-21.json') =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' });

let user: ReturnType<typeof userEvent.setup>;
const reload = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  user = userEvent.setup();
});
const render = () => renderWithToast(withAdmin(<DataPage reload={reload} />));
const pick = (content: unknown) => user.upload(screen.getByLabelText('Escolher arquivo de dados'), fileOf(content));

describe('Exportar e importar dados (web)', () => {
  describe('sucesso', () => {
    it('"Exportar dados" baixa o arquivo pela API', () => {
      render();
      const link = screen.getByRole('link', { name: 'Exportar dados' });
      expect(link).toHaveAttribute('href', '/api/admin/export');
      expect(link).toHaveAttribute('download');
      expect(screen.getByText(/contém os PINs dos gestores/)).toBeInTheDocument();
    });

    it('importar: mostra o resumo do arquivo, pede confirmação, substitui e pede para entrar de novo', async () => {
      api.post.mockResolvedValue({ employees: 8 });
      render();
      await pick(EXPORT);

      const summary = await screen.findByTestId('import-summary');
      expect(summary).toHaveTextContent('Arquivo exportado em 21/10/2026 às 11:40');
      expect(summary).toHaveTextContent('8 funcionários');
      expect(summary).toHaveTextContent('26 tarefas');
      expect(summary).toHaveTextContent('11 listas');
      expect(summary).toHaveTextContent('34 registros no histórico');
      expect(screen.getByText(/apagar todos os dados atuais/)).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Substituir todos os dados' }));
      expect(api.post).toHaveBeenCalledWith('/api/admin/import', EXPORT);
      expect(await screen.findByRole('heading', { name: 'Dados importados' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Entrar de novo' }));
      expect(reload).toHaveBeenCalled();
    });
  });

  describe('erro', () => {
    it('arquivo que não é JSON mostra mensagem simples', async () => {
      render();
      await pick('isto não é json');
      expect(await screen.findByRole('alert')).toHaveTextContent('Este arquivo não é uma exportação do Rastro.');
      expect(screen.queryByRole('button', { name: 'Substituir todos os dados' })).not.toBeInTheDocument();
    });

    it('JSON de outro sistema mostra a mesma mensagem', async () => {
      render();
      await pick({ hello: 'world' });
      expect(await screen.findByRole('alert')).toHaveTextContent('Este arquivo não é uma exportação do Rastro.');
    });

    it('falha no servidor mantém o resumo e mostra a mensagem, sem sair da página', async () => {
      api.post.mockRejectedValue(new ApiError(422, 'O arquivo está incompleto ou corrompido.'));
      render();
      await pick(EXPORT);
      await user.click(await screen.findByRole('button', { name: 'Substituir todos os dados' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('O arquivo está incompleto ou corrompido.');
      expect(screen.getByTestId('import-summary')).toBeInTheDocument();
      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('borda', () => {
    it('arquivo de versão mais nova é recusado antes de enviar', async () => {
      render();
      await pick({ ...EXPORT, version: 2 });
      expect(await screen.findByRole('alert')).toHaveTextContent('Este arquivo é de uma versão mais nova do Rastro.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('"Cancelar" descarta o arquivo sem importar', async () => {
      render();
      await pick(EXPORT);
      await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByTestId('import-summary')).not.toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('singular quando há um só registro de cada', async () => {
      render();
      const one = Object.fromEntries(Object.keys(EXPORT.tables).map((k) => [k, rows(1)]));
      await pick({ ...EXPORT, tables: one });
      const summary = await screen.findByTestId('import-summary');
      expect(summary).toHaveTextContent('1 funcionário');
      expect(summary).toHaveTextContent('1 tarefa');
      expect(summary).toHaveTextContent('1 lista');
      expect(summary).toHaveTextContent('1 registro no histórico');
    });
  });
});
