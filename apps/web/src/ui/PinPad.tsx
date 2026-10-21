import { useState } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

type Props = {
  /** Recebe o PIN completo; devolve mensagem de erro ou null. */
  onComplete: (pin: string) => Promise<string | null>;
  size?: 'md' | 'lg';
};

export function PinPad({ onComplete, size = 'md' }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function press(k: string) {
    if (busy) return;
    if (k === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    setError('');
    const next = pin + k;
    setPin(next);
    if (next.length < 4) return;
    setBusy(true);
    const err = await onComplete(next);
    setBusy(false);
    if (err) {
      setError(err);
      setPin('');
    }
  }

  return (
    <div className="pinpad">
      <div className="pinpad-dots">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            data-testid="pin-dot"
            data-filled={i < pin.length}
            className={`pinpad-dot${i < pin.length ? ' is-filled' : ''}${error ? ' is-error' : ''}`}
          />
        ))}
      </div>
      {error && (
        <div role="alert" className="pinpad-error">
          {error}
        </div>
      )}
      <div className={`pinpad-keys pinpad-keys--${size}`}>
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button key={i} type="button" className="pinpad-key" aria-label={k === 'del' ? 'Apagar' : k} onClick={() => press(k)}>
              {k === 'del' ? '⌫' : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
