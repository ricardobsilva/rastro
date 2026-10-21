import { describe, expect, it } from 'vitest';
import { appliesOn, assigneesOf } from '../src/schedule.js';

const cl = (o: Partial<Parameters<typeof appliesOn>[0]> = {}) => ({ active: true, period: 'daily' as const, days: [] as number[], ...o });

describe('appliesOn', () => {
  it('diário aparece todo dia (sucesso)', () => {
    for (let d = 0; d < 7; d++) expect(appliesOn(cl(), d)).toBe(true);
  });

  it('dias específicos só nos dias marcados (sucesso)', () => {
    const c = cl({ period: 'weekdays', days: [1, 4] });
    expect(appliesOn(c, 1)).toBe(true);
    expect(appliesOn(c, 4)).toBe(true);
    expect(appliesOn(c, 3)).toBe(false);
  });

  it('semanal no dia definido × outro dia (borda)', () => {
    const c = cl({ period: 'weekly', days: [3] });
    expect(appliesOn(c, 3)).toBe(true);
    expect(appliesOn(c, 2)).toBe(false);
  });

  it('sob demanda nunca é gerado automaticamente (borda)', () => {
    expect(appliesOn(cl({ period: 'ondemand' }), 3)).toBe(false);
  });

  it('inativo nunca aparece (erro de configuração)', () => {
    expect(appliesOn(cl({ active: false }), 3)).toBe(false);
  });

  it('semanal sem dia não aparece (borda)', () => {
    expect(appliesOn(cl({ period: 'weekly', days: [] }), 3)).toBe(false);
  });
});

describe('assigneesOf', () => {
  const emps = [
    { id: 'e1', group: 'Salão', active: true },
    { id: 'e2', group: 'Salão', active: true },
    { id: 'e3', group: 'Cozinha', active: true },
    { id: 'e8', group: 'Salão', active: false },
  ];

  it('união de funções e pessoas (sucesso)', () => {
    expect(assigneesOf({ roles: ['Salão'], employeeIds: ['e3'] }, emps).map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('pessoa que também está na função aparece uma vez (borda)', () => {
    expect(assigneesOf({ roles: ['Salão'], employeeIds: ['e1'] }, emps).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('inativos nunca recebem, nem atribuídos pessoalmente (borda)', () => {
    expect(assigneesOf({ roles: [], employeeIds: ['e8'] }, emps)).toEqual([]);
  });

  it('sem responsáveis ninguém recebe (erro de configuração)', () => {
    expect(assigneesOf({ roles: [], employeeIds: [] }, emps)).toEqual([]);
  });
});
