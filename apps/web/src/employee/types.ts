import type { CardStatus } from '../ui/status';

export type TodayCard = {
  executionId: number; checklistId: string; name: string; dueTime: string | null; done: number; total: number; status: CardStatus;
};
export type OnDemand = { checklistId: string; name: string; description: string; itemCount: number };
export type Today = {
  date: string; dateLabel: string; now: string; greeting: string;
  summary: { total: number; done: number; pending: number; late: number };
  cards: TodayCard[];
  onDemand: OnDemand[];
};

export type ExecItem = {
  itemId: string; name: string; description: string; required: boolean; allowNote: boolean;
  status: 'done' | 'pending' | 'late'; doneAt: string | null; undoneAt: string | null; note: string;
};
export type Execution = {
  id: number; date: string; checklistId: string; name: string; description: string; dueTime: string | null;
  done: number; total: number; status: CardStatus; items: ExecItem[];
};

export type Activity = { id: number; time: string; itemName: string; checklistName: string; action: 'done' | 'undone' | 'note'; note: string };
