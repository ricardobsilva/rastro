import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/index.js';
import { seedCasaBrasa as seed } from '../src/db/seed-casa-brasa.js';
import { seedDemo } from '../src/db/seed-demo.js';

const NOW = new Date('2026-10-21T11:40:00-03:00');
const count = (db: ReturnType<typeof openDb>, sql: string) => (db.prepare(sql).get() as { n: number }).n;

describe('seed de demonstração', () => {
  it('gera 7 dias anteriores e marcações de hoje (sucesso)', () => {
    const db = openDb();
    seed(db);
    seedDemo(db, NOW);
    expect(count(db, "SELECT COUNT(DISTINCT op_date) AS n FROM executions WHERE op_date < '2026-10-21'")).toBe(7);
    expect(count(db, "SELECT COUNT(*) AS n FROM audit_events WHERE op_date = '2026-10-21' AND action = 'done'")).toBeGreaterThan(20);
    expect(count(db, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'undone'")).toBeGreaterThan(0);
  });

  it('é idempotente: rodar de novo não duplica (borda)', () => {
    const db = openDb();
    seed(db);
    seedDemo(db, NOW);
    const events = count(db, 'SELECT COUNT(*) AS n FROM audit_events');
    seedDemo(db, NOW);
    expect(count(db, 'SELECT COUNT(*) AS n FROM audit_events')).toBe(events);
  });

  it('exige o seed base antes (erro)', () => {
    expect(() => seedDemo(openDb(), NOW)).toThrow('Rode o seed base antes do seed de demonstração.');
  });

  it('marcações de hoje nunca ficam no futuro (borda)', () => {
    const db = openDb();
    seed(db);
    seedDemo(db, new Date('2026-10-21T08:30:00-03:00'));
    expect(count(db, "SELECT COUNT(*) AS n FROM audit_events WHERE op_date = '2026-10-21' AND minute > 510")).toBe(0);
  });
});
