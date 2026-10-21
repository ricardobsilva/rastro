export type AuditAction = 'done' | 'undone' | 'note';

export const ACTION: Record<AuditAction, { label: string; fg: string; bg: string }> = {
  done: { label: 'Concluído', fg: '#2F7D4F', bg: '#E1F0E5' },
  undone: { label: 'Desmarcado', fg: '#8A5A12', bg: '#FBEFD9' },
  note: { label: 'Observação', fg: '#2F6F8F', bg: '#E2EDF2' },
};
