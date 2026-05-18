import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditDataHygiene } from './dataHygiene.mjs';

// New-shape license: the proxy attaches `renewalClass`, so the audit consumes
// it directly. `renewalDate` here is just the display string.
const baseLicense = (over: Record<string, unknown> = {}) => ({
  id: 'lic',
  application: 'X',
  department: 'IT',
  renewalDate: 'Apr 01, 2026',
  renewalClass: 'dated',
  renewalType: 'Fixed Date',
  amount: 1000,
  coOwners: [{ email: 'a@x.com' }],
  ...over,
});

test('auditDataHygiene flags a dated license with an email as ready', () => {
  const result = auditDataHygiene([baseLicense()]);
  assert.equal(result.total, 1);
  assert.equal(result.readyToFire, 1);
  assert.equal(result.withCoOwners, 1);
  assert.equal(result.withRealDate, 1);
  assert.deepEqual(result.needsAttention, []);
});

test('auditDataHygiene buckets licenses by renewalClass', () => {
  const result = auditDataHygiene([
    baseLicense({ id: '1', renewalClass: 'dated' }),
    baseLicense({ id: '2', renewalClass: 'projected' }),
    baseLicense({ id: '3', renewalClass: 'undated-by-design' }),
    baseLicense({ id: '4', renewalClass: 'missing' }),
    baseLicense({ id: '5', renewalClass: 'missing' }),
  ]);
  const counts: Record<string, number> = {};
  for (const b of result.buckets) counts[b.key] = b.count;
  assert.equal(counts.dated, 1);
  assert.equal(counts.projected, 1);
  assert.equal(counts['undated-by-design'], 1);
  assert.equal(counts.missing, 2);
  assert.equal(result.withRealDate, 2); // dated + projected
});

test('auditDataHygiene counts projected licenses as able to fire', () => {
  const result = auditDataHygiene([baseLicense({ renewalClass: 'projected' })]);
  assert.equal(result.readyToFire, 1);
  assert.deepEqual(result.needsAttention, []);
});

test('auditDataHygiene puts highest-spend missing-both rows at the top of needsAttention', () => {
  const result = auditDataHygiene([
    baseLicense({ id: 'small', renewalClass: 'missing', coOwners: [], amount: 500 }),
    baseLicense({ id: 'big', renewalClass: 'missing', coOwners: [], amount: 100_000 }),
    baseLicense({ id: 'date-only', renewalClass: 'dated', coOwners: [], amount: 80_000 }),
    baseLicense({ id: 'coowner-only', renewalClass: 'missing', coOwners: [{ email: 'a@x.com' }], amount: 80_000 }),
  ]);
  // missing-rank: date+co-owner (0) < date (1) < co-owner (2).
  assert.equal(result.needsAttention[0].id, 'big');
  assert.equal(result.needsAttention[0].missing, 'date+co-owner');
  const order = result.needsAttention.map((r) => r.id);
  assert.deepEqual(order, ['big', 'small', 'coowner-only', 'date-only']);
});

test('auditDataHygiene reports undated-by-design as intentionallySilent, not broken', () => {
  const result = auditDataHygiene([
    baseLicense({ id: '1', renewalClass: 'undated-by-design' }),
    baseLicense({ id: '2', renewalClass: 'undated-by-design' }),
    baseLicense({ id: '3', renewalClass: 'undated-by-design' }),
    baseLicense({ id: '4', renewalClass: 'dated' }),
  ]);
  assert.equal(result.intentionallySilent, 3);
  assert.equal(result.readyToFire, 1);
  assert.deepEqual(result.needsAttention.map((r) => r.id), []);
});

test('auditDataHygiene flags missing-class licenses as needsClassification', () => {
  const result = auditDataHygiene([
    baseLicense({ id: 'a', renewalClass: 'missing' }),
    baseLicense({ id: 'b', renewalClass: 'missing', coOwners: [] }),
  ]);
  assert.equal(result.needsClassification, 2);
  assert.deepEqual(result.needsAttention.map((r) => r.missing).sort(), ['date', 'date+co-owner']);
});

test('auditDataHygiene ignores co-owners without a valid email', () => {
  const result = auditDataHygiene([
    baseLicense({ id: '1', coOwners: [{ name: 'Beth' }] }),
    baseLicense({ id: '2', coOwners: [{ email: 'not-an-email' }] }),
    baseLicense({ id: '3', coOwners: [{ email: 'good@x.com' }] }),
  ]);
  assert.equal(result.withCoOwners, 1);
  assert.equal(result.readyToFire, 1);
});

test('auditDataHygiene falls back to classifying records that lack renewalClass', () => {
  // Legacy / hand-built records with no renewalClass — the audit classifies
  // them itself via the shared classifier.
  const result = auditDataHygiene([
    { id: 'cortavo', renewalType: 'Externally Managed', renewalDate: 'Managed by Cortavo', coOwners: [] },
    { id: 'cancel', renewalType: '', renewalDate: 'Until Cancelled', coOwners: [] },
    { id: 'broken', renewalType: 'Fixed Date', renewalDate: '', length: 'Annually', coOwners: [] },
  ]);
  assert.equal(result.intentionallySilent, 2);
  assert.equal(result.needsClassification, 1);
  assert.equal(result.needsAttention.length, 1);
  assert.equal(result.needsAttention[0].id, 'broken');
});
