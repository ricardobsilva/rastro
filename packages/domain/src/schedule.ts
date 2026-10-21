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

/** Funcionários ativos que recebem o checklist: união de funções e pessoas. */
export function assigneesOf<E extends { id: string; group: string; active: boolean }>(
  c: { roles: string[]; employeeIds: string[] },
  employees: E[],
): E[] {
  return employees.filter((e) => e.active && (c.employeeIds.includes(e.id) || c.roles.includes(e.group)));
}
