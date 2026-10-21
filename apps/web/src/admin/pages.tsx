import type { ComponentType } from 'react';
import type { PageId } from './context';

import { ItemsPage } from './ItemsPage';

const Soon = () => null;

export const PAGES: Record<PageId, ComponentType> = {
  dash: Soon,
  team: Soon,
  items: ItemsPage,
  cls: Soon,
  hist: Soon,
};
