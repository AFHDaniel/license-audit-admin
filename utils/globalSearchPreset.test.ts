import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGlobalInventoryPreset } from './globalSearchPreset';

test('buildGlobalInventoryPreset trims query and sets context label', () => {
  const preset = buildGlobalInventoryPreset('  Canva  ');

  assert.equal(preset.search, 'Canva');
  assert.equal(preset.contextLabel, 'Top nav search: Canva');
  assert.equal(preset.origin, 'TOP_NAV_SEARCH');
});

test('buildGlobalInventoryPreset keeps empty search when query is blank', () => {
  const preset = buildGlobalInventoryPreset('   ');

  assert.equal(preset.search, '');
  assert.equal(preset.contextLabel, 'Top nav search');
  assert.equal(preset.origin, 'TOP_NAV_SEARCH');
});
