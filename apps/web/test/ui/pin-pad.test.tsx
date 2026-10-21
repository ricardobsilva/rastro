import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PinPad } from '../../src/ui/PinPad';

const type = async (digits: string) => {
  for (const d of digits) await userEvent.click(screen.getByRole('button', { name: d }));
};

describe('PinPad', () => {
  it('envia o PIN ao completar 4 dígitos (sucesso)', async () => {
    const onComplete = vi.fn().mockResolvedValue(null);
    render(<PinPad onComplete={onComplete} />);
    await type('1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('mostra o erro retornado e limpa os dígitos (erro)', async () => {
    const onComplete = vi.fn().mockResolvedValue('PIN sem permissão de gestor.');
    render(<PinPad onComplete={onComplete} />);
    await type('9999');
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN sem permissão de gestor.');
    expect(screen.getAllByTestId('pin-dot').filter((d) => d.dataset.filled === 'true')).toHaveLength(0);
  });

  it('apagar remove o último dígito e não envia com menos de 4 (borda)', async () => {
    const onComplete = vi.fn().mockResolvedValue(null);
    render(<PinPad onComplete={onComplete} />);
    await type('12');
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }));
    await type('3');
    expect(screen.getAllByTestId('pin-dot').filter((d) => d.dataset.filled === 'true')).toHaveLength(2);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('digitar um novo número limpa a mensagem de erro (borda)', async () => {
    const onComplete = vi.fn().mockResolvedValue('Errado');
    render(<PinPad onComplete={onComplete} />);
    await type('0000');
    await screen.findByRole('alert');
    await type('1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
