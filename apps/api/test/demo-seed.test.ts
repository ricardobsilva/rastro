import type { Db } from '../src/db/index.js';
import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/index.js';
import { seedCasaBrasa as seed } from '../src/db/seed-casa-brasa.js';
import { seedDemo } from '../src/db/seed-demo.js';

const NOW = new Date('2026-10-21T11:40:00-03:00');
const count = async (db: Db, sql: string) => (await db.prepare(sql).get() as { n: number }).n;

describe('seed de demonstração', () => {
  it('gera 7 dias anteriores e marcações de hoje (sucesso)', async () => {
    const db = await openDb();
    await seed(db);
    await seedDemo(db, NOW);
    expect(await count(db, "SELECT COUNT(DISTINCT op_date) AS n FROM executions WHERE op_date < '2026-10-21'")).toBe(7);
    expect(await count(db, "SELECT COUNT(*) AS n FROM audit_events WHERE op_date = '2026-10-21' AND action = 'done'")).toBeGreaterThan(20);
    expect(await count(db, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'undone'")).toBeGreaterThan(0);
  });

  it('é idempotente: rodar de novo não duplica (borda)', async () => {
    const db = await openDb();
    await seed(db);
    await seedDemo(db, NOW);
    const events = await count(db, 'SELECT COUNT(*) AS n FROM audit_events');
    await seedDemo(db, NOW);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM audit_events')).toBe(events);
  });

  it('exige o seed base antes (erro)', async () => {
    await expect(seedDemo(await openDb(), NOW)).rejects.toThrow('Rode o seed base antes do seed de demonstração.');
  });

  it('marcações de hoje nunca ficam no futuro (borda)', async () => {
    const db = await openDb();
    await seed(db);
    await seedDemo(db, new Date('2026-10-21T08:30:00-03:00'));
    expect(await count(db, "SELECT COUNT(*) AS n FROM audit_events WHERE op_date = '2026-10-21' AND minute > 510")).toBe(0);
  });
});
