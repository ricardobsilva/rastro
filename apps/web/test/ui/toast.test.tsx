import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../../src/ui/Toast';

function Trigger({ msg, kind }: { msg: string; kind?: 'ok' | 'warn' }) {
  const toast = useToast();
  return <button onClick={() => toast(msg, kind)}>disparar</button>;
}

describe('Toast', () => {
  afterEach(() => vi.useRealTimers());

  it('mostra a mensagem (sucesso)', async () => {
    render(<ToastProvider><Trigger msg="Observação salva." /></ToastProvider>);
    await userEvent.click(screen.getByText('disparar'));
    expect(screen.getByRole('status')).toHaveTextContent('Observação salva.');
  });

  it('marca o tipo aviso (borda)', async () => {
    render(<ToastProvider><Trigger msg="Item desmarcado." kind="warn" /></ToastProvider>);
    await userEvent.click(screen.getByText('disparar'));
    expect(screen.getByRole('status')).toHaveAttribute('data-kind', 'warn');
  });

  it('some depois de 3 segundos (borda)', () => {
    vi.useFakeTimers();
    render(<ToastProvider><Trigger msg="Oi" /></ToastProvider>);
    act(() => screen.getByText('disparar').click());
    expect(screen.getByRole('status')).toHaveAttribute('data-open', 'true');
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('status')).toHaveAttribute('data-open', 'false');
  });

  it('useToast fora do provider falha com mensagem clara (erro)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger msg="x" />)).toThrow('useToast precisa de <ToastProvider>');
    spy.mockRestore();
  });
});
