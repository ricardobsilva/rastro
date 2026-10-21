import type { ComponentType } from 'react';
import type { PageId } from './context';

import { ChecklistsPage } from './ChecklistsPage';
import { ItemsPage } from './ItemsPage';
import { TeamPage } from './TeamPage';

const Soon = () => null;

export const PAGES: Record<PageId, ComponentType> = {
  dash: Soon,
  team: TeamPage,
  items: ItemsPage,
  cls: ChecklistsPage,
  hist: Soon,
};
