export type AdminItem = {
  id: string; name: string; description: string; category: string; required: boolean; allowNote: boolean; active: boolean; usedIn: string[];
};

export type AdminEmployee = import('../types').Employee & { active: boolean; hasPin: boolean; isManager: boolean; unitIds: string[] };
export type AdminUnit = import('../types').Unit & { active: boolean; lateToday: number };
export type DateOption = { value: string; label: string };
export type TeamItem = { itemName: string; status: 'done' | 'pending' | 'late'; doneAt: string | null; note: string };
export type TeamGroup = { executionId: number; checklistName: string; unit: string | null; dueTime: string | null; items: TeamItem[] };
export type TeamRow = { employeeId: string; total: number; done: number; late: number; groups: TeamGroup[] };
export type TeamData = { date: string; dateLabel: string; isToday: boolean; rows: TeamRow[] };

export type Period = 'daily' | 'weekdays' | 'weekly' | 'ondemand';
export type AdminChecklist = {
  id: string; name: string; description: string; period: Period; days: number[]; dueTime: string | null;
  employeeIds: string[]; itemIds: string[]; active: boolean; unitId: string | null; assignees: string[];
};

type Person = { employeeId: string; name: string; firstName: string; role: string; color: string; initials: string };
export type Dashboard = {
  date: string; isToday: boolean; now: string; dateLabel: string;
  kpis: { total: number; done: number; pending: number; late: number; pct: number; checklists: number };
  byUnit: { unitId: string | null; name: string; total: number; done: number; late: number; pct: number }[];
  byChecklist: { id: string; unit: string | null; name: string; done: number; late: number; total: number }[];
  lateCount: number;
  lateList: (Person & { itemName: string; checklistName: string; unit: string | null; due: string | null; delayMin: number | null })[];
  pendingByEmployee: (Person & { pending: number; late: number })[];
  byCategory: { category: string; n: number; pct: number }[];
  trend: { date: string; label: string; pct: number }[];
};

export type HistoryRow = {
  id: number; date: string; dateLabel: string; time: string; checklistName: string; unit: string | null; itemName: string;
  employeeId: string; employeeName: string; initials: string; color: string; action: 'done' | 'undone' | 'note'; note: string;
};
export type HistoryPageData = { total: number; undone: number; rows: HistoryRow[] };
