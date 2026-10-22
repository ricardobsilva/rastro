import type { ComponentType } from 'react';
import type { PageId } from './context';

import { ChecklistsPage } from './ChecklistsPage';
import { DashboardPage } from './DashboardPage';
import { ItemsPage } from './ItemsPage';
import { TeamPage } from './TeamPage';

const Soon = () => null;

export const PAGES: Record<PageId, ComponentType> = {
  dash: DashboardPage,
  team: TeamPage,
  items: ItemsPage,
  cls: ChecklistsPage,
  hist: Soon,
};
