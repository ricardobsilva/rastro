const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60_000;

/** Limita tentativas de PIN por origem: 5 erros bloqueiam por 5 minutos. */
export class PinGuard {
  private failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(private clock: () => Date) {}

  isLocked(key: string): boolean {
    const f = this.failures.get(key);
    if (!f || f.lockedUntil === 0) return false;
    if (this.clock().getTime() >= f.lockedUntil) {
      this.failures.delete(key);
      return false;
    }
    return true;
  }

  fail(key: string): void {
    const f = this.failures.get(key) ?? { count: 0, lockedUntil: 0 };
    f.count += 1;
    if (f.count >= MAX_FAILURES) f.lockedUntil = this.clock().getTime() + LOCK_MS;
    this.failures.set(key, f);
  }

  succeed(key: string): void {
    this.failures.delete(key);
  }
}
