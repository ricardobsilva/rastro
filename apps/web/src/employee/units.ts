import type { Today } from './types';

/** As tarefas do dia são de mais de uma unidade? Só então vale mostrar o nome dela. */
export const hasManyUnits = (t: Pick<Today, 'cards' | 'onDemand'>) =>
  new Set([...t.cards, ...t.onDemand].map((x) => x.unit).filter(Boolean)).size > 1;

/** Cartões agrupados por unidade, na ordem em que aparecem; o que vale para todas vai no fim. */
export function byUnit<T extends { unit: string | null }>(list: T[]): { unit: string | null; list: T[] }[] {
  const named = [...new Set(list.map((x) => x.unit).filter((u): u is string => !!u))];
  return [...named, null].map((unit) => ({ unit, list: list.filter((x) => (x.unit ?? null) === unit) })).filter((g) => g.list.length > 0);
}
