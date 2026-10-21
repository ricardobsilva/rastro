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
