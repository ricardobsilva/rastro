import { WEEKDAYS, WEEKDAYS_SHORT } from '@rastro/domain';
import type { Period } from './types';

export function periodLabel(c: { period: Period; days: number[] }): string {
  if (c.period === 'daily') return 'Todos os dias';
  if (c.period === 'ondemand') return 'Sob demanda';
  if (c.period === 'weekly') return `Semanal · ${c.days.length ? WEEKDAYS[c.days[0]!] : 'sem dia'}`;
  return c.days.length ? [...c.days].sort().map((d) => WEEKDAYS_SHORT[d]).join(', ') : 'Nenhum dia';
}
