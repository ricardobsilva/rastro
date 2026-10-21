export type ItemStatus = 'done' | 'pending' | 'late';
export type CardStatus = 'done' | 'pending' | 'late' | 'progress';

/** Atrasado = não concluído depois do prazo (no minuto exato ainda está no prazo). */
export function itemStatus({ done, due, now }: { done: boolean; due: number | null; now: number }): ItemStatus {
  if (done) return 'done';
  return due !== null && now > due ? 'late' : 'pending';
}

export function cardStatus(items: ItemStatus[]): CardStatus {
  if (items.length && items.every((s) => s === 'done')) return 'done';
  if (items.includes('late')) return 'late';
  if (items.includes('done')) return 'progress';
  return 'pending';
}

const rank = (s: CardStatus) => (s === 'late' ? 0 : s === 'done' ? 2 : 1);

export function compareCards(a: { status: CardStatus; due: number | null }, b: { status: CardStatus; due: number | null }) {
  return rank(a.status) - rank(b.status) || (a.due ?? Infinity) - (b.due ?? Infinity);
}

export function greeting(minute: number): string {
  if (minute < 720) return 'Bom dia';
  if (minute < 1080) return 'Boa tarde';
  return 'Boa noite';
}

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function longDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[dow]}, ${d} de ${MONTHS[m - 1]}`;
}

export const shortDate = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
