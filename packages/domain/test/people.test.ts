import { describe, expect, it } from 'vitest';
import { firstName, initials, shortName } from '../src/people.js';

describe('nomes de pessoas', () => {
  it('iniciais, primeiro nome e nome curto (sucesso)', () => {
    expect(initials('João Silva')).toBe('JS');
    expect(firstName('João Silva')).toBe('João');
    expect(shortName('João Silva')).toBe('João S.');
  });

  it('usa o último sobrenome e no máximo 2 iniciais (sucesso)', () => {
    expect(initials('Ana Maria Costa')).toBe('AM');
    expect(shortName('Ana Maria Costa')).toBe('Ana C.');
  });

  it('nome de uma palavra (borda)', () => {
    expect(initials('Rafa')).toBe('R');
    expect(shortName('Rafa')).toBe('Rafa');
  });

  it('espaços extras e minúsculas (borda)', () => {
    expect(initials('  joão   silva ')).toBe('JS');
    expect(shortName('  joão   silva ')).toBe('joão S.');
  });

  it('nome vazio não quebra (erro)', () => {
    expect(initials('')).toBe('');
    expect(shortName('   ')).toBe('');
  });
});
