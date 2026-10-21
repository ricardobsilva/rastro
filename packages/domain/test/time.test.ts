import { describe, expect, it } from 'vitest';
import { dueMinute, fmtMinute, operationalNow, toMinute } from '../src/time.js';

const at = (iso: string) => new Date(iso);

describe('operationalNow (fuso America/Sao_Paulo, virada às 04:00)', () => {
  it('meio do dia: mesma data, minutos desde 00:00 (sucesso)', () => {
    expect(operationalNow(at('2026-10-21T11:40:00-03:00'))).toEqual({ date: '2026-10-21', minute: 700, dow: 3 });
  });

  it('converte de UTC para o horário local (sucesso)', () => {
    expect(operationalNow(at('2026-10-21T14:40:00Z')).minute).toBe(700);
  });

  it('00:20 ainda pertence ao dia anterior, com minuto > 1440 (borda)', () => {
    expect(operationalNow(at('2026-10-22T00:20:00-03:00'))).toEqual({ date: '2026-10-21', minute: 1460, dow: 3 });
  });

  it('03:59 é o último minuto do dia anterior; 04:00 abre o novo dia (borda)', () => {
    expect(operationalNow(at('2026-10-22T03:59:00-03:00')).date).toBe('2026-10-21');
    expect(operationalNow(at('2026-10-22T04:00:00-03:00'))).toEqual({ date: '2026-10-22', minute: 240, dow: 4 });
  });

  it('virada de mês e de ano (borda)', () => {
    expect(operationalNow(at('2027-01-01T01:00:00-03:00')).date).toBe('2026-12-31');
    expect(operationalNow(at('2026-11-01T02:00:00-03:00')).date).toBe('2026-10-31');
  });
});

describe('toMinute / fmtMinute / dueMinute', () => {
  it('convertem HH:mm (sucesso)', () => {
    expect(toMinute('10:30')).toBe(630);
    expect(fmtMinute(630)).toBe('10:30');
  });

  it('formatam minutos depois da meia-noite (borda)', () => {
    expect(fmtMinute(1460)).toBe('00:20');
  });

  it('horário inválido → null (erro)', () => {
    expect(toMinute('25:00')).toBeNull();
    expect(toMinute('abc')).toBeNull();
    expect(toMinute(null)).toBeNull();
    expect(toMinute('')).toBeNull();
  });

  it('prazo antes da virada (02:00) é do fim do dia operacional (borda)', () => {
    expect(dueMinute('02:00')).toBe(1560);
    expect(dueMinute('23:45')).toBe(1425);
    expect(dueMinute(null)).toBeNull();
  });
});
