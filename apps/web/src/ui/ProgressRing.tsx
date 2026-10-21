const CIRC = 213.6; // 2πr com r = 34

export function ProgressRing({ value, size = 84 }: { value: number; size?: number }) {
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r="34" fill="none" stroke="#2F6450" strokeWidth="9" />
        <circle
          cx="42" cy="42" r="34" fill="none" stroke="#F4EFE6" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={(CIRC * (1 - value)).toFixed(1)} className="ring-progress"
        />
      </svg>
      <div className="ring-label">{Math.round(value * 100)}%</div>
    </div>
  );
}
