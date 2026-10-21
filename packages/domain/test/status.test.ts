import { describe, expect, it } from 'vitest';
import { cardStatus, compareCards, greeting, itemStatus, longDate } from '../src/status.js';

describe('itemStatus', () => {
  it('concluído vence qualquer prazo (sucesso)', () => {
    expect(itemStatus({ done: true, due: 630, now: 900 })).toBe('done');
  });
  it('pendente dentro do prazo (sucesso)', () => {
    expect(itemStatus({ done: false, due: 630, now: 600 })).toBe('pending');
  });
  it('exatamente no prazo ainda não está atrasado; um minuto depois sim (borda)', () => {
    expect(itemStatus({ done: false, due: 630, now: 630 })).toBe('pending');
    expect(itemStatus({ done: false, due: 630, now: 631 })).toBe('late');
  });
  it('sem prazo (sob demanda) nunca atrasa (borda)', () => {
    expect(itemStatus({ done: false, due: null, now: 1500 })).toBe('pending');
  });
});

describe('cardStatus', () => {
  it('tudo concluído → done (sucesso)', () => {
    expect(cardStatus(['done', 'done'])).toBe('done');
  });
  it('algum atrasado → late, mesmo com outros concluídos (sucesso)', () => {
    expect(cardStatus(['done', 'late', 'pending'])).toBe('late');
  });
  it('algum concluído sem atraso → progress (sucesso)', () => {
    expect(cardStatus(['done', 'pending'])).toBe('progress');
  });
  it('nada feito → pending; lista vazia → pending (borda)', () => {
    expect(cardStatus(['pending'])).toBe('pending');
    expect(cardStatus([])).toBe('pending');
  });
});

describe('compareCards: atrasados → pendentes/andamento por horário → concluídos', () => {
  it('ordena (sucesso)', () => {
    const cards = [
      { id: 'done', status: 'done' as const, due: 500 },
      { id: 'pend-tarde', status: 'pending' as const, due: 1400 },
      { id: 'late-2', status: 'late' as const, due: 700 },
      { id: 'prog', status: 'progress' as const, due: 900 },
      { id: 'late-1', status: 'late' as const, due: 600 },
      { id: 'sem-prazo', status: 'pending' as const, due: null },
    ];
    expect(cards.sort(compareCards).map((c) => c.id)).toEqual(['late-1', 'late-2', 'prog', 'pend-tarde', 'sem-prazo', 'done']);
  });
});

describe('greeting', () => {
  it.each([
    [240, 'Bom dia'], [719, 'Bom dia'], [720, 'Boa tarde'], [1079, 'Boa tarde'], [1080, 'Boa noite'], [1460, 'Boa noite'],
  ])('minuto %i → %s (borda nas viradas)', (m, g) => expect(greeting(m)).toBe(g));
});

describe('longDate', () => {
  it('data por extenso em pt-BR (sucesso)', () => {
    expect(longDate('2026-10-21')).toBe('quarta-feira, 21 de outubro');
    expect(longDate('2026-03-01')).toBe('domingo, 1 de março');
  });
});
