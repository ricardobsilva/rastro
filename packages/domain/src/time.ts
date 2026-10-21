export const TIMEZONE = 'America/Sao_Paulo';
/** O dia operacional vira às 04:00: o que acontece de madrugada conta para a noite anterior. */
export const DAY_CUTOFF_MIN = 4 * 60;

export type OperationalNow = {
  /** Data do dia operacional, YYYY-MM-DD. */
  date: string;
  /** Minutos desde 00:00 do dia operacional (pode passar de 1440 de madrugada). */
  minute: number;
  /** Dia da semana do dia operacional (0 = domingo). */
  dow: number;
};

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function dayOfWeek(key: string): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function operationalNow(at: Date, timeZone = TIMEZONE, cutoff = DAY_CUTOFF_MIN): OperationalNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let date = dateKey(get('year'), get('month'), get('day'));
  let minute = get('hour') * 60 + get('minute');
  if (minute < cutoff) {
    date = addDays(date, -1);
    minute += 1440;
  }
  return { date, minute, dow: dayOfWeek(date) };
}

export function toMinute(hhmm: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Prazo em minutos do dia operacional: horários antes da virada caem no fim do dia. */
export function dueMinute(hhmm: string | null | undefined, cutoff = DAY_CUTOFF_MIN): number | null {
  const m = toMinute(hhmm);
  if (m === null) return null;
  return m < cutoff ? m + 1440 : m;
}

export function fmtMinute(minute: number): string {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
