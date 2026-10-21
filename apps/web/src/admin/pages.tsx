import type { ComponentType } from 'react';
import type { PageId } from './context';

import { ItemsPage } from './ItemsPage';
import { TeamPage } from './TeamPage';

const Soon = () => null;

export const PAGES: Record<PageId, ComponentType> = {
  dash: Soon,
  team: TeamPage,
  items: ItemsPage,
  cls: Soon,
  hist: Soon,
};
