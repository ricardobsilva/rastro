import { createContext, useContext } from 'react';
import type { Employee } from '../types';

export type PageId = 'dash' | 'team' | 'items' | 'cls' | 'hist' | 'guide';

export type AdminCtx = {
  manager: Employee;
  /** Data compartilhada entre Painel e Equipe (YYYY-MM-DD ou null = hoje). */
  date: string | null;
  setDate: (d: string | null) => void;
  selectedEmployee: string | null;
  go: (page: PageId, opts?: { employeeId?: string }) => void;
  refreshBadge: () => void;
};

export const AdminContext = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin precisa de <AdminContext.Provider>');
  return ctx;
}
