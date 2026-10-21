// Dados fictícios do cliente-piloto "Casa Brasa" (espelham o protótipo).
type Period = 'daily' | 'weekdays' | 'weekly' | 'ondemand';

export const EMPLOYEES = [
  { id: 'e1', name: 'João Silva', role: 'Garçom', grp: 'Salão', color: '#C2502F' },
  { id: 'e2', name: 'Ana Costa', role: 'Garçonete', grp: 'Salão', color: '#2F6F8F' },
  { id: 'e3', name: 'Carlos Mendes', role: 'Cozinheiro', grp: 'Cozinha', color: '#8A5A12' },
  { id: 'e4', name: 'Beatriz Rocha', role: 'Auxiliar de cozinha', grp: 'Cozinha', color: '#5B4B8A' },
  { id: 'e5', name: 'Rafael Lima', role: 'Bartender', grp: 'Bar', color: '#1F4D3B' },
  { id: 'e7', name: 'Diego Souza', role: 'Auxiliar de limpeza', grp: 'Limpeza', color: '#4A5560' },
  { id: 'e6', name: 'Marina Alves', role: 'Gerente', grp: 'Gerência', color: '#9C3B54', pin: '1234' },
  { id: 'e8', name: 'Paula Nunes', role: 'Garçonete', grp: 'Salão', color: '#6B6A63', active: false },
];

// [id, nome, descrição, categoria, obrigatório, permite observação, ativo?]
const ITEM_ROWS: [string, string, string, string, boolean, boolean, boolean?][] = [
  ['i1', 'Conferir organização das mesas', 'Mesas alinhadas, cadeiras posicionadas e toalhas sem manchas.', 'Organização', true, false],
  ['i2', 'Verificar guardanapos', 'Repor os porta-guardanapos de todas as mesas.', 'Atendimento', false, false],
  ['i3', 'Conferir talheres', 'Talheres limpos e polidos para 80 lugares.', 'Atendimento', true, true],
  ['i4', 'Verificar limpeza do salão', 'Piso, vidros e banheiros de clientes.', 'Limpeza', true, true],
  ['i5', 'Conferir disponibilidade de arroz', 'Mínimo de 2 sacos de 5 kg no estoque seco.', 'Estoque', false, true],
  ['i6', 'Verificar funcionamento dos equipamentos', 'Forno, chapa, fritadeira e máquina de café.', 'Equipamentos', true, true],
  ['i7', 'Ligar exaustores e coifas', '', 'Equipamentos', true, false],
  ['i8', 'Conferir temperatura das câmaras frias', 'Resfriados até 5 °C, congelados até −18 °C. Anote as leituras.', 'Equipamentos', true, true],
  ['i9', 'Verificar validade dos perecíveis', 'Separar itens que vencem em até 2 dias.', 'Estoque', true, true],
  ['i10', 'Separar mise en place do almoço', 'Conforme a ficha do prato do dia.', 'Cozinha', false, false],
  ['i11', 'Higienizar bancadas de preparo', 'Álcool 70% após a limpeza com detergente.', 'Limpeza', true, false],
  ['i12', 'Conferir estoque de bebidas', 'Refrigerantes, águas, cervejas e sucos.', 'Estoque', false, true],
  ['i13', 'Repor gelo no bar', '', 'Estoque', false, false],
  ['i14', 'Conferir cardápios e displays', 'Cardápios limpos e sem páginas danificadas.', 'Organização', false, false],
  ['i15', 'Testar máquinas de cartão', 'Ligar, conferir bateria e conexão.', 'Equipamentos', true, false],
  ['i16', 'Retirar lixo e recicláveis', '', 'Limpeza', false, false],
  ['i17', 'Desligar equipamentos de cocção', '', 'Equipamentos', true, false],
  ['i18', 'Fechar registro de gás', '', 'Equipamentos', true, false],
  ['i19', 'Lavar e guardar utensílios', '', 'Cozinha', false, false],
  ['i20', 'Conferir caixa e sangria', 'Valor final conferido com o relatório do PDV.', 'Organização', true, true],
  ['i21', 'Trancar portas e acionar alarme', '', 'Organização', true, false],
  ['i22', 'Confirmar entrega de hortifrúti', 'Conferir nota fiscal, peso e qualidade.', 'Estoque', true, true],
  ['i23', 'Limpar filtros da coifa', 'Desmontar, desengordurar e secar.', 'Limpeza', true, false],
  ['i24', 'Abastecer produtos de limpeza', '', 'Estoque', false, false, false],
  ['i25', 'Conferir reservas do dia', 'Separar as mesas reservadas com placa.', 'Atendimento', false, true],
  ['i26', 'Recolher e higienizar cardápios', '', 'Limpeza', false, false],
];

export const ITEMS = ITEM_ROWS.map(([id, name, description, category, required, allowNote, active]) => ({
  id, name, description, category, required, allowNote, active: active !== false,
}));

export const CHECKLISTS: {
  id: string; name: string; description: string; items: string[]; dueTime: string | null;
  period: Period; days: number[]; roles: string[]; employees: string[];
}[] = [
  { id: 'c1', name: 'Abertura do restaurante', description: 'Preparação do salão antes da abertura das portas.', items: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'], dueTime: '10:30', period: 'daily', days: [], roles: ['Salão'], employees: [] },
  { id: 'c2', name: 'Organização do salão', description: 'Ajustes finais antes do almoço.', items: ['i14', 'i25', 'i15'], dueTime: '11:30', period: 'daily', days: [], roles: ['Salão'], employees: [] },
  { id: 'c4', name: 'Abertura da cozinha', description: '', items: ['i7', 'i8', 'i11', 'i10', 'i6'], dueTime: '10:00', period: 'daily', days: [], roles: [], employees: ['e4'] },
  { id: 'c3', name: 'Conferência de estoque', description: 'Estoque seco, câmaras e bebidas.', items: ['i5', 'i9', 'i12', 'i22', 'i8'], dueTime: '11:00', period: 'daily', days: [], roles: [], employees: ['e3'] },
  { id: 'c6', name: 'Abertura do bar', description: '', items: ['i12', 'i13', 'i15'], dueTime: '11:00', period: 'daily', days: [], roles: [], employees: ['e5'] },
  { id: 'c9', name: 'Limpeza geral', description: '', items: ['i4', 'i16', 'i11'], dueTime: '09:30', period: 'daily', days: [], roles: ['Limpeza'], employees: [] },
  { id: 'c8', name: 'Limpeza da coifa', description: 'Limpeza profunda semanal.', items: ['i23', 'i11'], dueTime: '15:00', period: 'weekly', days: [3], roles: [], employees: ['e7'] },
  { id: 'c5', name: 'Fechamento do salão', description: 'Deixar o salão pronto para o dia seguinte.', items: ['i26', 'i16', 'i1'], dueTime: '23:30', period: 'daily', days: [], roles: ['Salão'], employees: [] },
  { id: 'c7', name: 'Fechamento do restaurante', description: '', items: ['i17', 'i18', 'i19', 'i20', 'i21'], dueTime: '23:45', period: 'daily', days: [], roles: [], employees: ['e6'] },
  { id: 'c10', name: 'Recebimento de compras', description: 'Usar sempre que chegar mercadoria.', items: ['i22', 'i9', 'i5'], dueTime: null, period: 'ondemand', days: [], roles: ['Cozinha'], employees: [] },
  { id: 'c11', name: 'Conferência da adega', description: '', items: ['i12', 'i9'], dueTime: '16:00', period: 'weekdays', days: [1, 4], roles: [], employees: ['e5'] },
];
