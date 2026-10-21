import { z } from 'zod';
import type { Db } from '../db/index.js';
import { HttpError, parse } from '../http.js';
import type { PinGuard } from './pin-guard.js';

export const pinSchema = z.object({
  pin: z.string({ message: 'O PIN deve ter 4 números.' }).regex(/^\d{4}$/, 'O PIN deve ter 4 números.'),
});

export type Manager = { id: string; name: string; role: string; color: string };

/** Valida PIN de gestor ativo (função Gerência), com limite de tentativas. */
export function checkManagerPin(db: Db, guard: PinGuard, key: string, body: unknown): Manager {
  const { pin } = parse(pinSchema, body);
  if (guard.isLocked(key)) throw new HttpError(429, 'Muitas tentativas. Tente novamente em alguns minutos.');
  const manager = db
    .prepare("SELECT id, name, role, color FROM employees WHERE pin = ? AND active = 1 AND grp = 'Gerência'")
    .get(pin) as Manager | undefined;
  if (!manager) {
    guard.fail(key);
    throw new HttpError(401, 'PIN sem permissão de gestor.');
  }
  guard.succeed(key);
  return manager;
}
