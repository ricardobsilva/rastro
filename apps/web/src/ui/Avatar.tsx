import type { CSSProperties } from 'react';

type Props = { initials: string; color: string; size?: number; ring?: boolean; style?: CSSProperties };

export function Avatar({ initials, color, size = 40, ring, style }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`avatar${ring ? ' avatar--ring' : ''}`}
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.34), ...style }}
    >
      {initials}
    </span>
  );
}
