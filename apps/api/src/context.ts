import type { Db } from './db/index.js';
import type { PinGuard } from './security/pin-guard.js';

export type AppContext = { db: Db; clock: () => Date; pinGuard: PinGuard };
