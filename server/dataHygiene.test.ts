import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditDataHygiene } from './dataHygiene.mjs';

const baseLicense = (over: Record<string, unknown> = {}) => ({
  id: 'lic',
  application: 'X',
  department: 'IT',
  renewalDate: 'Apr 01, 2026',
  renewalType: 'Fixed Date',
  amount: 1000,
  coOwners: [{ email: 'a@x.com' }],
  ...over,
});

test('auditDataHygiene flags a license with a real date and an email as ready', () => {
  const result = auditDataHygiene([baseLicense()]);
  assert.equal(result.total, 1);
  assert.equal(result.readyToFire, 1);
  assert.equal(result.withCoOwners, 1);
  assert.equal(result.withRealDate, 1);
  assert.deepEqual(result.needsAttention, []);
});

test('auditDataHygiene buckets renewal-date strings correctly', () => {
  const result = auditDataHygiene([
    baseLicense({ id: '1', renewalDate: 'Apr 01, 2026' }),
    baseLicense({ id: '2', renewalDate: 'TBD' }),
    baseLicense({ id: '3', renewalDate: 'n/a' }),
    baseLicense({ id: '4', renewalDate: 'Until Cancelled' }),
    baseLicense({ id: '5', renewalDate: 'month to month' }),
    baseLicense({ id: '6', renewalDate: '' }),
    baseLicense({ id: '7', renewalDate: 'June & November' }),
    baseLicense({ id: '8', renewalDate: '11/2026' }),
  ]);
  const counts: Record<string, number> = {};
  for (const b of result.buckets) counts[b.key] = b.count;
  assert.equal(counts.parseable, 1);
  assert.equal(counts.tbd, 1);
  assert.equal(counts.na, 1);
  assert.equal(counts.untilCancelled, 1);
  assert.equal(counts.monthToMonth, 1);
  assert.equal(counts.empty, 1);
  assert.equal(counts.unstructured, 1);
  assert.equal(counts.monthYearOnly, 1);
});

test('auditDataHygiene puts highest-spend missing-both rows at the top of needsAttention', () => {
  const result = auditDataHygiene([
    baseLicense({ id: 'small', renewalDate: 'TBD', coOwners: [], amount: 500 }),
    baseLicense({ id: 'big', renewalDate: 'TBD', coOwners: [], amount: 100_000 }),
    baseLicense({ id: 'date-only', renewalDate: 'Apr 01, 2026', coOwners: [], amount: 80_000 }),
    baseLicense({ id: 'coowner-only', renewalDate: 'TBD', coOwners: [{ email: 'a@x.com' }], amount: 80_000 }),
  ]);
  // 'big' / 'small' / 'coowner-only' all have TBD as the renewal date but
  // renewalType='Fixed Date' from the base fixture, so they fall into
  // missing-date buckets. 'date-only' has a real date but no co-owner.
  // missing-rank is date+co-owner (2) < date (3) < co-owner (4).
  assert.equal(result.needsAttention[0].id, 'big');
  assert.equal(result.needsAttention[0].missing, 'date+co-owner');
  const order = result.needsAttention.map((r) => r.id);
  assert.deepEqual(order, ['big', 'small', 'coowner-only', 'date-only']);
});

test('auditDataHygiene reports non-firing types as intentionallySilent, not broken', () => {
  const result = auditDataHygiene([
    baseLicense({ id: '1', renewalType: 'Until Cancelled', renewalDate: '' }),
    baseLicense({ id: '2', renewalType: 'Month-to-month', renewalDate: '' }),
    baseLicense({ id: '3', renewalType: 'Externally Managed', renewalDate: '' }),
    baseLicense({ id: '4', renewalType: 'Fixed Date', renewalDate: 'Apr 01, 2026' }),
  ]);
  assert.equal(result.intentionallySilent, 3);
  assert.equal(result.readyToFire, 1);
  assert.deepEqual(result.needsAttention.map((r) => r.id), []);
});

test('auditDataHygiene flags licenses missing renewalType as needsClassification', () => {
  const result = auditDataHygiene([
    baseLicense({ id: 'untyped', renewalType: '' }),
    baseLicense({ id: 'pending', renewalType: 'Pending' }),
  ]);
  assert.equal(result.needsClassification, 2);
  assert.deepEqual(result.needsAttention.map((r) => r.missing).sort(), ['renewal-type', 'renewal-type-pending']);
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

test('auditDataHygiene treats "Managed by <vendor>" in the date field as intentionally silent', () => {
  const result = auditDataHygiene([
    baseLicense({ id: 'cortago', renewalType: '', renewalDate: 'Managed by Cortago' }),
    baseLicense({ id: 'until-cancel', renewalType: '', renewalDate: 'Until Canceled' }),
  ]);
  // Neither should be flagged as needing attention or classification.
  assert.equal(result.intentionallySilent, 2);
  assert.equal(result.needsClassification, 0);
  assert.equal(result.needsAttention.length, 0);
});

test('auditDataHygiene buckets "Managed by Cortago" as externallyManaged (neutral), not unstructured', () => {
  const result = auditDataHygiene([
    baseLicense({ id: 'cortago', renewalType: '', renewalDate: 'Managed by Cortago' }),
  ]);
  const byKey = Object.fromEntries(result.buckets.map((b) => [b.key, b]));
  assert.equal(byKey.externallyManaged.count, 1);
  assert.equal(byKey.externallyManaged.severity, 'neutral');
  assert.equal(byKey.unstructured.count, 0);
});
