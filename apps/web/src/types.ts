export type Employee = {
  id: string; name: string; shortName: string; firstName: string; initials: string; role: string; group: string; color: string;
};
export type Unit = { id: string; name: string };
export type Session = { employee: Employee | null; since: string | null };
