// Dados de domínio: vão para produção. Nada de equipe ou listas aqui, o gestor cadastra aos poucos.

/** Gestor inicial do restaurante. O PIN deve ser trocado pelo próprio gestor depois do primeiro acesso. */
export const MANAGER = { id: 'e_gestor', name: 'Rodrigo Cortez', role: 'Gerente', grp: 'Gerência', pin: '2200', color: '#9C3B54' };

// Biblioteca de tarefas sugeridas: [id, nome, descrição, categoria, obrigatório, permite observação, ativo?]
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
