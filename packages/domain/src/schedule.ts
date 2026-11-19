export type Period = 'daily' | 'weekdays' | 'weekly' | 'ondemand';
export const PERIODS: Period[] = ['daily', 'weekdays', 'weekly', 'ondemand'];
export const GROUPS = ['Salão', 'Cozinha', 'Bar', 'Limpeza', 'Gerência'] as const;
export const CATEGORIES = ['Limpeza', 'Estoque', 'Organização', 'Cozinha', 'Atendimento', 'Equipamentos'] as const;
export const MANAGER_GROUP = 'Gerência';

/** O checklist é gerado automaticamente neste dia da semana? */
export function appliesOn(c: { active: boolean; period: Period; days: number[] }, dow: number): boolean {
  if (!c.active) return false;
  if (c.period === 'daily') return true;
  if (c.period === 'ondemand') return false;
  return c.days.includes(dow);
}

/**
 * Funcionários ativos que recebem o checklist: só as pessoas escolhidas.
 * A função é apenas um atalho na tela para marcar várias pessoas de uma vez.
 */
export function assigneesOf<E extends { id: string; active: boolean }>(c: { employeeIds: string[] }, employees: E[]): E[] {
  return employees.filter((e) => e.active && c.employeeIds.includes(e.id));
}
