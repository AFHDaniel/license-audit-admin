import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCoOwnersFromMondayColumn } from './mondayCoOwners';

test('resolveCoOwnersFromMondayColumn maps people ids through a monday user directory', () => {
  const coOwners = resolveCoOwnersFromMondayColumn(
    {
      text: 'Alex Carter, Jordan Lee',
      value: {
        personsAndTeams: [
          { id: 101, kind: 'person' },
          { id: 202, kind: 'person' },
        ],
      },
    },
    new Map([
      ['101', { id: '101', name: 'Alex Carter', email: 'alex@example.com' }],
      ['202', { id: '202', name: 'Jordan Lee', email: 'jordan@example.com' }],
    ]),
  );

  assert.deepEqual(coOwners, [
    { name: 'Alex Carter', email: 'alex@example.com' },
    { name: 'Jordan Lee', email: 'jordan@example.com' },
  ]);
});

test('resolveCoOwnersFromMondayColumn supports email-based payloads without directory ids', () => {
  const coOwners = resolveCoOwnersFromMondayColumn(
    {
      text: 'Alex Carter, Jordan Lee',
      value: {
        personsAndTeams: [
          { email: 'alex@example.com', name: 'Alex Carter' },
          { email: 'jordan@example.com', name: 'Jordan Lee' },
        ],
      },
    },
    new Map(),
  );

  assert.deepEqual(coOwners, [
    { name: 'Alex Carter', email: 'alex@example.com' },
    { name: 'Jordan Lee', email: 'jordan@example.com' },
  ]);
});

test('resolveCoOwnersFromMondayColumn falls back to column text names when emails are unavailable', () => {
  const coOwners = resolveCoOwnersFromMondayColumn(
    {
      text: 'Alex Carter, Jordan Lee',
      value: null,
    },
    new Map(),
  );

  assert.deepEqual(coOwners, [
    { name: 'Alex Carter', email: '' },
    { name: 'Jordan Lee', email: '' },
  ]);
});
