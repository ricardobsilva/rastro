export const CATEGORY_TONE: Record<string, string> = {
  Limpeza: '#2F6F8F', Estoque: '#8A5A12', 'Organização': '#5B4B8A', Cozinha: '#B2462A', Atendimento: '#1F4D3B', Equipamentos: '#4A5560',
};
export const toneOf = (cat: string) => CATEGORY_TONE[cat] ?? '#4A5560';
