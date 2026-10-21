import type { ComponentType } from 'react';
import type { PageId } from './context';

const Soon = () => null;

export const PAGES: Record<PageId, ComponentType> = {
  dash: Soon,
  team: Soon,
  items: Soon,
  cls: Soon,
  hist: Soon,
};
