import { render, screen } from '@testing-library/react';
import { App } from '../src/App';

describe('US00 — web', () => {
  it('renderiza a marca Rastro (sucesso)', () => {
    render(<App />);
    expect(screen.getByText('Rastro')).toBeInTheDocument();
  });
});
