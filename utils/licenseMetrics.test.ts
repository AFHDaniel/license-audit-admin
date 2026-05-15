import test from 'node:test';
import assert from 'node:assert/strict';

import { License } from '../types';
import { getDaysUntilRenewal, isUndatedByDesign } from './licenseMetrics';

const lic = (renewalDate: string): License => ({
  id: '1',
  application: 'Test App',
  vendor: 'Test',
  amount: 100,
  length: '12 months',
  renewalMethod: 'Credit Card',
  renewalDate,
  seats: '5',
  useCase: 'General',
  progress: 50,
  department: 'IT',
  sourceBoardId: 'b',
  sourceBoardName: 'Board',
  recordBoardId: 'b',
  recordBoardName: 'Board',
  recordKind: 'item',
  coOwners: [],
  riskLevel: 'Low Risk',
  status: 'Healthy',
});

test('isUndatedByDesign matches "Until Cancelled" and "Until Canceled" (both spellings)', () => {
  assert.equal(isUndatedByDesign(lic('Until Cancelled')), true);
  assert.equal(isUndatedByDesign(lic('Until Canceled')), true);
  assert.equal(isUndatedByDesign(lic('until canceled')), true);
});

test('isUndatedByDesign matches any "Managed by ___" vendor', () => {
  assert.equal(isUndatedByDesign(lic('Managed by Cortago')), true);
  assert.equal(isUndatedByDesign(lic('managed by some other MSP')), true);
  assert.equal(isUndatedByDesign(lic('Externally Managed')), true);
});

test('isUndatedByDesign matches ongoing / continuous / month-to-month', () => {
  assert.equal(isUndatedByDesign(lic('Ongoing')), true);
  assert.equal(isUndatedByDesign(lic('continuous')), true);
  assert.equal(isUndatedByDesign(lic('Month to month')), true);
  assert.equal(isUndatedByDesign(lic('month-to-month')), true);
});

test('isUndatedByDesign is false for real dates, blank, and TBD', () => {
  assert.equal(isUndatedByDesign(lic('Apr 01, 2026')), false);
  assert.equal(isUndatedByDesign(lic('2026-08-31')), false);
  assert.equal(isUndatedByDesign(lic('')), false);
  assert.equal(isUndatedByDesign(lic('TBD')), false);
});

test('a license that is undated-by-design also has no days-until-renewal', () => {
  // Confirms the two predicates agree: these are the rows that used to be
  // wrongly counted as "missing date".
  const managed = lic('Managed by Cortago');
  assert.equal(getDaysUntilRenewal(managed), null);
  assert.equal(isUndatedByDesign(managed), true);
});
