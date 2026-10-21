import { describe, expect, it } from 'vitest';
import { finishMessage, missingRequiredMessage } from '../src/finish.js';

describe('mensagens de conclusão', () => {
  it('lista obrigatórios pendentes no plural (erro)', () => {
    expect(missingRequiredMessage(['Conferir talheres', 'Verificar limpeza do salão'])).toBe(
      'Faltam 2 itens obrigatórios: Conferir talheres, Verificar limpeza do salão.',
    );
  });
  it('singular com um obrigatório (borda)', () => {
    expect(missingRequiredMessage(['Conferir talheres'])).toBe('Falta 1 item obrigatório: Conferir talheres.');
  });
  it('tudo feito → concluído (sucesso)', () => {
    expect(finishMessage(0)).toEqual({ kind: 'ok', message: 'Checklist concluído! Tudo registrado em seu nome.' });
  });
  it('opcionais pendentes → aviso singular/plural (borda)', () => {
    expect(finishMessage(1)).toEqual({ kind: 'warn', message: 'Checklist salvo. 1 item continua pendente.' });
    expect(finishMessage(3)).toEqual({ kind: 'warn', message: 'Checklist salvo. 3 itens continuam pendentes.' });
  });
});
