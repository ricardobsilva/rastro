import type { ReactElement } from 'react';
import { AdminContext, type AdminCtx } from '../../src/admin/context';
import { MARINA } from '../helpers';

export const adminCtx = (o: Partial<AdminCtx> = {}): AdminCtx => ({
  manager: MARINA, date: null, setDate: vi.fn(), selectedEmployee: null, go: vi.fn(), refreshBadge: vi.fn(), ...o,
});

export const withAdmin = (ui: ReactElement, o: Partial<AdminCtx> = {}) => <AdminContext.Provider value={adminCtx(o)}>{ui}</AdminContext.Provider>;
