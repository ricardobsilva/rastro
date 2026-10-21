type Props = { checked: boolean; onChange: () => void; label?: string; ariaLabel?: string; large?: boolean };

export function Switch({ checked, onChange, label, ariaLabel, large }: Props) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} className={`switch${large ? ' switch--lg' : ''}`} onClick={onChange}>
      <span className="switch-track"><span className="switch-thumb" /></span>
      {label}
    </button>
  );
}
