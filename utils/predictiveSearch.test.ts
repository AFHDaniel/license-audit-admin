import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSuggestionCorpus, getPredictiveSuggestions } from './predictiveSearch';

test('buildSuggestionCorpus deduplicates and trims suggestion values', () => {
  const corpus = buildSuggestionCorpus([
    {
      application: 'Canva',
      vendor: 'Canva',
      department: 'Marketing',
      sourceBoardName: 'Marketing Board',
    },
    {
      application: '  Canva  ',
      vendor: 'Adobe',
      department: 'Marketing',
      sourceBoardName: 'Design Board',
    },
  ]);

  assert.deepEqual(corpus, [
    'Adobe',
    'Canva',
    'Design Board',
    'Marketing',
    'Marketing Board',
  ]);
});

test('getPredictiveSuggestions prioritizes prefix matches and enforces limit', () => {
  const suggestions = getPredictiveSuggestions(
    'can',
    ['Canva', 'Arcane Systems', 'Team Canvas', 'Thecan Tool', 'Cancelation Ops'],
    3,
  );

  assert.deepEqual(suggestions, ['Canva', 'Cancelation Ops', 'Team Canvas']);
});

test('getPredictiveSuggestions returns empty results for blank query', () => {
  const suggestions = getPredictiveSuggestions('   ', ['Canva', 'Adobe']);

  assert.deepEqual(suggestions, []);
});
