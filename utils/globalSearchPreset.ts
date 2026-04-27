import { InventoryFilterPreset } from '../types';

export function buildGlobalInventoryPreset(rawQuery: string): InventoryFilterPreset {
  const search = String(rawQuery ?? '').trim();

  return {
    search,
    contextLabel: search ? `Top nav search: ${search}` : 'Top nav search',
    origin: 'TOP_NAV_SEARCH',
  };
}
