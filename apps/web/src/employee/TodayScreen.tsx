import type { Employee } from '../types';

export function TodayScreen({ me }: { me: Employee }) {
  return <h1>Meu dia de {me.firstName}</h1>;
}
