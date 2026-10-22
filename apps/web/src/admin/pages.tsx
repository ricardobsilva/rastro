import type { ComponentType } from 'react';
import { ChecklistsPage } from './ChecklistsPage';
import { DashboardPage } from './DashboardPage';
import { HistoryPage } from './HistoryPage';
import { ItemsPage } from './ItemsPage';
import { TeamPage } from './TeamPage';
import type { PageId } from './context';

export const PAGES: Record<PageId, ComponentType> = {
  dash: DashboardPage,
  team: TeamPage,
  items: ItemsPage,
  cls: ChecklistsPage,
  hist: HistoryPage,
};
