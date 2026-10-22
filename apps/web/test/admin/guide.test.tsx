import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../src/api/client';
import { GuidePage } from '../../src/admin/GuidePage';
import { renderWithToast } from '../helpers';
import { withAdmin } from './helpers';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }));
vi.mock('../../src/api/client', async (orig) => ({ ...(await orig<object>()), api }));

const it_ = (id: string, name: string, active = true) => ({ id, name, description: '', category: 'Limpeza', required: false, allowNote: false, active, usedIn: [] });
const ITEMS = [it_('i1', 'Conferir mesas'), it_('i3', 'Conferir talheres'), it_('i24', 'Abastecer limpeza', false)];
const emp = (id: string, name: string, group: string, active = true) => ({ id, name, firstName: name.split(' ')[0], shortName: name, initials: 'XX', role: 'r', group, color: '#000', active, hasPin: false, isManager: false });
const EMPS = [emp('e1', 'João Silva', 'Salão'), emp('e2', 'Ana Costa', 'Salão'), emp('e5', 'Rafael Lima', 'Bar'), emp('e9', 'Paula Nunes', 'Limpeza', false)];
const CLS = [{ id: 'c1', name: 'Abertura do restaurante' }];
const CREATED = { id: 'c_new', name: 'Abertura da varanda', assignees: ['João Silva', 'Ana Costa'] };

let user: ReturnType<typeof userEvent.setup>;
const go = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  user = userEvent.setup();
  api.get.mockImplementation(async (url: string) => ({ '/api/admin/checklists': CLS, '/api/admin/items': ITEMS, '/api/admin/employees': EMPS })[url]);
});

const render = () => renderWithToast(withAdmin(<GuidePage />, { go }));
const next = () => user.click(screen.getByRole('button', { name: 'Próximo' }));
const back = () => user.click(screen.getByRole('button', { name: 'Voltar' }));
const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });

async function untilName(name = 'Abertura da varanda') {
  render();
  await user.click(await screen.findByRole('button', { name: 'Começar' }));
  await heading('Como vai se chamar esta lista?');
  if (name) await user.type(screen.getByLabelText('Nome da lista'), name);
  await next();
}
async function addTask(text: string) {
  await user.type(screen.getByLabelText('Nova tarefa'), `${text}{Enter}`);
}
async function untilWho() {
  await untilName();
  await addTask('Varrer a varanda');
  await user.click(await screen.findByRole('button', { name: '+ Conferir talheres' }));
  await next();
  await heading('Quem vai fazer?');
}

describe('US18 — assistente do primeiro checklist (web)', () => {
  describe('sucesso', () => {
    it('fluxo completo: responde uma pergunta por vez, confere o resumo e cria a lista', async () => {
      api.post.mockResolvedValue(CREATED);
      await untilWho();
      expect(screen.getByText('Passo 3 de 6')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Salão/ }));
      await next();

      await heading('Em quais dias?');
      await user.click(screen.getByRole('button', { name: 'Todos os dias' }));
      await next();

      await heading('Até que horas precisa estar pronto?');
      await user.click(screen.getByRole('button', { name: '11:00' }));
      await next();

      await heading('Está tudo certo?');
      expect(screen.getByText('Passo 6 de 6')).toBeInTheDocument();
      const summary = screen.getByTestId('guide-summary');
      expect(summary).toHaveTextContent('A lista Abertura da varanda tem 2 tarefas.');
      expect(summary).toHaveTextContent('Quem faz: Salão (João, Ana).');
      expect(summary).toHaveTextContent('Quando: todos os dias, até 11:00.');

      await user.click(screen.getByRole('button', { name: 'Criar a lista' }));
      expect(api.post).toHaveBeenCalledWith('/api/admin/checklists/guided', {
        name: 'Abertura da varanda', tasks: ['Varrer a varanda', 'Conferir talheres'], roles: ['Salão'], period: 'daily', days: [], dueTime: '11:00',
      });
      await heading('Pronto! A lista foi criada.');
      expect(screen.getByText(/João e Ana já vão ver esta lista no celular/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Ver minhas listas' }));
      expect(go).toHaveBeenCalledWith('cls');
    });

    it('"Só em alguns dias" envia os dias escolhidos em ordem e mostra no resumo', async () => {
      api.post.mockResolvedValue(CREATED);
      await untilWho();
      await user.click(screen.getByRole('button', { name: /Bar/ }));
      await next();
      await user.click(screen.getByRole('button', { name: 'Só em alguns dias' }));
      await user.click(screen.getByRole('button', { name: 'Sexta' }));
      await user.click(screen.getByRole('button', { name: 'Segunda' }));
      await next();
      await user.click(screen.getByRole('button', { name: 'Outro horário' }));
      await user.type(screen.getByLabelText('Escolha o horário'), '16:45');
      await next();

      expect(screen.getByTestId('guide-summary')).toHaveTextContent('Quando: segunda e sexta, até 16:45.');
      await user.click(screen.getByRole('button', { name: 'Criar a lista' }));
      expect(api.post).toHaveBeenCalledWith('/api/admin/checklists/guided', expect.objectContaining({ roles: ['Bar'], period: 'weekdays', days: [1, 5], dueTime: '16:45' }));
    });

    it('"Criar outra lista" recomeça do zero', async () => {
      api.post.mockResolvedValue(CREATED);
      await untilWho();
      await user.click(screen.getByRole('button', { name: /Salão/ }));
      await next();
      await user.click(screen.getByRole('button', { name: 'Só quando alguém pedir' }));
      await next();
      await user.click(screen.getByRole('button', { name: 'Criar a lista' }));
      await user.click(await screen.findByRole('button', { name: 'Criar outra lista' }));
      await heading('Como vai se chamar esta lista?');
      expect(screen.getByLabelText('Nome da lista')).toHaveValue('');
    });
  });

  describe('erro', () => {
    it('não avança sem nome', async () => {
      await untilName('');
      expect(screen.getByRole('alert')).toHaveTextContent('Escreva o nome da lista.');
      expect(screen.getByRole('heading', { level: 1, name: 'Como vai se chamar esta lista?' })).toBeInTheDocument();
    });

    it('avisa quando já existe uma lista com o mesmo nome', async () => {
      await untilName(' abertura do RESTAURANTE');
      expect(screen.getByRole('alert')).toHaveTextContent('Já existe uma lista com esse nome. Escolha outro.');
    });

    it('não avança sem tarefas', async () => {
      await untilName();
      await next();
      expect(screen.getByRole('alert')).toHaveTextContent('Escreva pelo menos uma tarefa.');
    });

    it('não avança sem escolher quem faz', async () => {
      await untilWho();
      await next();
      expect(screen.getByRole('alert')).toHaveTextContent('Escolha quem vai fazer.');
    });

    it('"Só em alguns dias" sem dia escolhido não avança', async () => {
      await untilWho();
      await user.click(screen.getByRole('button', { name: /Salão/ }));
      await next();
      await user.click(screen.getByRole('button', { name: 'Só em alguns dias' }));
      await next();
      expect(screen.getByRole('alert')).toHaveTextContent('Escolha pelo menos um dia.');
    });

    it('falha do servidor mantém o resumo e mostra a mensagem', async () => {
      api.post.mockRejectedValue(new ApiError(0, 'Sem conexão com o servidor.'));
      await untilWho();
      await user.click(screen.getByRole('button', { name: /Salão/ }));
      await next();
      await user.click(screen.getByRole('button', { name: 'Só quando alguém pedir' }));
      await next();
      await user.click(screen.getByRole('button', { name: 'Criar a lista' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
      expect(screen.getByTestId('guide-summary')).toBeInTheDocument();
    });
  });

  describe('borda', () => {
    it('"Só quando alguém pedir" pula o horário e o passo vira "de 5"', async () => {
      await untilWho();
      await user.click(screen.getByRole('button', { name: /Salão/ }));
      await next();
      await user.click(screen.getByRole('button', { name: 'Só quando alguém pedir' }));
      await next();
      await heading('Está tudo certo?');
      expect(screen.getByText('Passo 5 de 5')).toBeInTheDocument();
      expect(screen.getByTestId('guide-summary')).toHaveTextContent('Quando: só quando alguém pedir.');
    });

    it('função sem ninguém ativo fica desabilitada e mostra os nomes das outras', async () => {
      await untilWho();
      expect(screen.getByRole('button', { name: /Limpeza/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Limpeza/ })).toHaveTextContent('Ninguém nesta função');
      expect(screen.getByRole('button', { name: /Salão/ })).toHaveTextContent('João, Ana');
    });

    it('tarefa repetida não entra duas vezes e "Tirar" remove', async () => {
      await untilName();
      await addTask('Varrer a varanda');
      await addTask('  varrer a VARANDA ');
      expect(screen.getByRole('alert')).toHaveTextContent('Essa tarefa já está na lista.');
      expect(screen.getAllByTestId('guide-task')).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Tirar Varrer a varanda' }));
      expect(screen.queryAllByTestId('guide-task')).toHaveLength(0);
    });

    it('sugestões mostram só tarefas ativas que ainda não estão na lista', async () => {
      await untilName();
      expect(screen.getByRole('button', { name: '+ Conferir mesas' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '+ Abastecer limpeza' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '+ Conferir mesas' }));
      expect(screen.queryByRole('button', { name: '+ Conferir mesas' })).not.toBeInTheDocument();
    });

    it('"Voltar" preserva as respostas', async () => {
      await untilWho();
      await back();
      await heading('O que precisa ser feito?');
      expect(screen.getAllByTestId('guide-task')).toHaveLength(2);
      await back();
      expect(screen.getByLabelText('Nome da lista')).toHaveValue('Abertura da varanda');
    });

    it('sugestão de nome preenche o campo e esconde nomes que já existem', async () => {
      render();
      await user.click(await screen.findByRole('button', { name: 'Começar' }));
      expect(screen.queryByRole('button', { name: 'Abertura do restaurante' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Limpeza da cozinha' }));
      expect(screen.getByLabelText('Nome da lista')).toHaveValue('Limpeza da cozinha');
    });
  });
});
