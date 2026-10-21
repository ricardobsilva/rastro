const words = (name: string) => name.trim().split(/\s+/).filter(Boolean);

export const initials = (name: string) =>
  words(name)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const firstName = (name: string) => words(name)[0] ?? '';

/** "João Silva" → "João S." */
export function shortName(name: string): string {
  const w = words(name);
  if (w.length <= 1) return w[0] ?? '';
  return `${w[0]} ${w[w.length - 1]![0]!.toUpperCase()}.`;
}
