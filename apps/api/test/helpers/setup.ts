import request from 'supertest';
import { createApp } from '../../src/app.js';
import { openDb } from '../../src/db/index.js';
import { seed } from '../../src/db/seed.js';

export type TestClock = { now: Date; set(iso: string): void; advanceMinutes(n: number): void };

/** Relógio controlável. Horários informados em America/Sao_Paulo (UTC-3). */
export function testClock(local = '2026-10-21T11:40'): TestClock {
  const c: TestClock = {
    now: new Date(`${local}:00-03:00`),
    set(l) { c.now = new Date(`${l}:00-03:00`); },
    advanceMinutes(n) { c.now = new Date(c.now.getTime() + n * 60_000); },
  };
  return c;
}

export function setup(opts: { local?: string; seed?: boolean } = {}) {
  const db = openDb();
  if (opts.seed !== false) seed(db);
  const clock = testClock(opts.local);
  const app = createApp({ db, clock: () => clock.now });
  return { db, clock, app };
}

export const MANAGER_PIN = '1234';

/** Agente HTTP com aparelho já autorizado (cookie persistido). */
export async function authorizedAgent(app: Parameters<typeof request.agent>[0]) {
  const agent = request.agent(app);
  const res = await agent.post('/api/device/authorize').send({ pin: MANAGER_PIN });
  if (res.status !== 201) throw new Error(`falha ao autorizar aparelho: ${res.status}`);
  return agent;
}

/** Aparelho autorizado já identificado como o funcionário informado. */
export async function employeeAgent(app: Parameters<typeof request.agent>[0], employeeId: string) {
  const agent = await authorizedAgent(app);
  const res = await agent.post('/api/session').send({ employeeId });
  if (res.status !== 201) throw new Error(`falha ao identificar ${employeeId}: ${res.status}`);
  return agent;
}

/** Agente com sessão de gestor (Marina). */
export async function adminAgent(app: Parameters<typeof request.agent>[0]) {
  const agent = request.agent(app);
  const res = await agent.post('/api/admin/login').send({ pin: MANAGER_PIN });
  if (res.status !== 201) throw new Error(`falha no login do gestor: ${res.status}`);
  return agent;
}
