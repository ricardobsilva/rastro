export type AdminItem = {
  id: string; name: string; description: string; category: string; required: boolean; allowNote: boolean; active: boolean; usedIn: string[];
};

export type AdminEmployee = import('../types').Employee & { active: boolean; hasPin: boolean; isManager: boolean };
export type DateOption = { value: string; label: string };
export type TeamItem = { itemName: string; status: 'done' | 'pending' | 'late'; doneAt: string | null; note: string };
export type TeamGroup = { checklistName: string; dueTime: string | null; items: TeamItem[] };
export type TeamRow = { employeeId: string; total: number; done: number; late: number; groups: TeamGroup[] };
export type TeamData = { date: string; dateLabel: string; isToday: boolean; rows: TeamRow[] };

export type Period = 'daily' | 'weekdays' | 'weekly' | 'ondemand';
export type AdminChecklist = {
  id: string; name: string; description: string; period: Period; days: number[]; dueTime: string | null;
  roles: string[]; employeeIds: string[]; itemIds: string[]; active: boolean; assignees: string[];
};
