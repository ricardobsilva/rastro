import { useResource } from '../api/useResource';
import type { DateOption } from './types';

/** Hoje + 7 dias anteriores, com rótulos calculados no servidor. */
export const useDates = () => useResource<DateOption[]>('/api/admin/dates').data ?? [];
