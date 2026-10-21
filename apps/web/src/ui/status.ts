export type CardStatus = 'done' | 'pending' | 'late' | 'progress';

export const STATUS: Record<CardStatus, { label: string; fg: string; bg: string }> = {
  done: { label: 'Concluído', fg: '#2F7D4F', bg: '#E1F0E5' },
  pending: { label: 'Pendente', fg: '#5E5D57', bg: '#EFE9DE' },
  late: { label: 'Atrasado', fg: '#B3261E', bg: '#F9E0DD' },
  progress: { label: 'Em andamento', fg: '#8A5A12', bg: '#FBEFD9' },
};

export const barColor = (s: CardStatus) => (s === 'late' ? '#C2502F' : s === 'done' ? '#2F7D4F' : '#1F4D3B');

export const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
