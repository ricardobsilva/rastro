import { type ReactNode, useId } from 'react';

type Props = { title: string; onClose: () => void; children: ReactNode; width?: number };

export function Modal({ title, onClose, children, width = 520 }: Props) {
  const id = useId();
  return (
    <div className="modal-overlay" data-testid="modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={id} className="modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <h2 id={id} className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
