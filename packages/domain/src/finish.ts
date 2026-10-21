export function missingRequiredMessage(names: string[]): string {
  const n = names.length;
  const head = n === 1 ? 'Falta 1 item obrigatório' : `Faltam ${n} itens obrigatórios`;
  return `${head}: ${names.join(', ')}.`;
}

export function finishMessage(pending: number): { kind: 'ok' | 'warn'; message: string } {
  if (pending === 0) return { kind: 'ok', message: 'Checklist concluído! Tudo registrado em seu nome.' };
  const tail = pending === 1 ? '1 item continua pendente.' : `${pending} itens continuam pendentes.`;
  return { kind: 'warn', message: `Checklist salvo. ${tail}` };
}
