import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react';

type Kind = 'ok' | 'warn';
type Show = (msg: string, kind?: Kind) => void;

const ToastContext = createContext<Show | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: Kind; open: boolean }>({ msg: '', kind: 'ok', open: false });
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback<Show>((msg, kind = 'ok') => {
    clearTimeout(timer.current);
    setToast({ msg, kind, open: true });
    timer.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="toast" data-open={toast.open} data-kind={toast.kind}>
        <div className="toast-body">
          <span className="toast-dot" />
          {toast.msg}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast precisa de <ToastProvider>');
  return show;
}
