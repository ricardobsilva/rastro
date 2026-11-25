import { createContext, useContext } from 'react';
import type { Employee } from '../types';
import type { AdminUnit } from './types';

export type PageId = 'dash' | 'team' | 'items' | 'cls' | 'hist' | 'guide' | 'units' | 'data';

export type AdminCtx = {
  manager: Employee;
  /** Data compartilhada entre Painel e Equipe (YYYY-MM-DD ou null = hoje). */
  date: string | null;
  setDate: (d: string | null) => void;
  selectedEmployee: string | null;
  go: (page: PageId, opts?: { employeeId?: string }) => void;
  refreshBadge: () => void;
  /** Todas as unidades, inclusive desativadas. Vazio = restaurante sem unidades. */
  units: AdminUnit[];
  /** Unidade escolhida no menu; null = todas. Vale para Painel, Equipe, Checklists e Histórico. */
  unitId: string | null;
  setUnitId: (id: string | null) => void;
};

export const AdminContext = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin precisa de <AdminContext.Provider>');
  return ctx;
}

/** "Configuração" ou "Configuração · Farol", conforme a unidade escolhida. */
export function useUnitLabel(label: string): string {
  const { units, unitId } = useAdmin();
  const unit = units.find((u) => u.id === unitId);
  return unit ? `${label} · ${unit.name}` : label;
}
