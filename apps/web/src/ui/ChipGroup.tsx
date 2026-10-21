type Props<T extends string> = { options: readonly T[]; value: T | T[]; onToggle: (v: T) => void; labels?: Partial<Record<T, string>>; size?: 'sm' | 'md' };

/** Chips selecionáveis: único (value: T) ou múltiplo (value: T[]). */
export function ChipGroup<T extends string>({ options, value, onToggle, labels, size = 'sm' }: Props<T>) {
  const on = (o: T) => (Array.isArray(value) ? value.includes(o) : value === o);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={on(o)} className={`chip-btn${size === 'sm' ? ' chip-btn--sm' : ''}`} onClick={() => onToggle(o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
