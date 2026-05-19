import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRenewal,
  parseRenewalDate,
  cadenceMonthsFromLength,
} from './renewalClassifier.mjs';

const NOW = new Date(2026, 4, 18); // 2026-05-18, local

test('parseRenewalDate reads YYYY-MM-DD as a local date', () => {
  const d = parseRenewalDate('2026-11-01');
  assert.equal(d?.getFullYear(), 2026);
  assert.equal(d?.getMonth(), 10);
  assert.equal(d?.getDate(), 1);
});

test('parseRenewalDate returns null for empty and unparseable text', () => {
  assert.equal(parseRenewalDate(''), null);
  assert.equal(parseRenewalDate('Managed by Cortavo'), null);
  assert.equal(parseRenewalDate('See Notes'), null);
  assert.equal(parseRenewalDate(undefined), null);
});

test('cadenceMonthsFromLength maps known terms to a month count', () => {
  assert.equal(cadenceMonthsFromLength('Annually'), 12);
  assert.equal(cadenceMonthsFromLength('Monthly'), 1);
  assert.equal(cadenceMonthsFromLength('Quarterly'), 3);
  assert.equal(cadenceMonthsFromLength('3 Year'), 36);
  assert.equal(cadenceMonthsFromLength('12 month'), 12);
  assert.equal(cadenceMonthsFromLength('12'), 12);
  assert.equal(cadenceMonthsFromLength('Both'), null);
  assert.equal(cadenceMonthsFromLength('No Contract'), null);
  assert.equal(cadenceMonthsFromLength(''), null);
});

test('classifyRenewal: a future Fixed Date is dated', () => {
  const r = classifyRenewal({ renewalType: 'Fixed Date', rawDate: '2026-11-01', length: 'Annually', now: NOW });
  assert.equal(r.renewalClass, 'dated');
  assert.equal(r.renewalDateISO, '2026-11-01');
  assert.match(r.renewalDateDisplay, /Nov 01, 2026/);
});

test('classifyRenewal: today counts as dated, not projected', () => {
  const r = classifyRenewal({ renewalType: 'Fixed Date', rawDate: '2026-05-18', length: 'Annually', now: NOW });
  assert.equal(r.renewalClass, 'dated');
  assert.equal(r.renewalDateISO, '2026-05-18');
});

test('classifyRenewal: a lapsed annual date rolls forward to the next cycle', () => {
  // Renewed 2024-03-10, annual term -> next occurrence after 2026-05-18 is 2027-03-10.
  const r = classifyRenewal({ renewalType: 'Fixed Date', rawDate: '2024-03-10', length: 'Annually', now: NOW });
  assert.equal(r.renewalClass, 'projected');
  assert.equal(r.renewalDateISO, '2027-03-10');
});

test('classifyRenewal: a lapsed date with no usable term stays a dated (overdue) record', () => {
  const r = classifyRenewal({ renewalType: 'Fixed Date', rawDate: '2025-01-15', length: 'Both', now: NOW });
  assert.equal(r.renewalClass, 'dated');
  assert.equal(r.renewalDateISO, '2025-01-15');
});

test('classifyRenewal: undated-by-design renewal types carry a clean label, no date', () => {
  for (const [type, label] of [
    ['Until Cancelled', 'Until cancelled'],
    ['Month-to-month', 'Month-to-month'],
    ['Externally Managed', 'Externally managed'],
    ['One-time', 'One-time purchase'],
  ]) {
    const r = classifyRenewal({ renewalType: type, rawDate: '', length: 'Monthly', now: NOW });
    assert.equal(r.renewalClass, 'undated-by-design');
    assert.equal(r.renewalDateISO, null);
    assert.equal(r.renewalDateDisplay, label);
  }
});

test('classifyRenewal: undated-by-design wins even when junk text is present', () => {
  const r = classifyRenewal({ renewalType: 'One-time', rawDate: 'n/a', length: 'No Contract', now: NOW });
  assert.equal(r.renewalClass, 'undated-by-design');
  assert.equal(r.renewalDateDisplay, 'One-time purchase');
});

test('classifyRenewal: blank-type legacy rows fall back to free-text signals', () => {
  assert.equal(classifyRenewal({ rawDate: 'Until Cancelled', now: NOW }).renewalClass, 'undated-by-design');
  assert.equal(classifyRenewal({ rawDate: 'Managed by Cortavo', now: NOW }).renewalClass, 'undated-by-design');
  assert.equal(classifyRenewal({ rawDate: 'N/A', now: NOW }).renewalClass, 'undated-by-design');
});

test('classifyRenewal: a record with no date renews on its term, never "missing"', () => {
  const r = classifyRenewal({ renewalType: 'Fixed Date', rawDate: '', length: 'Annually', now: NOW });
  assert.equal(r.renewalClass, 'undated-by-design');
  assert.equal(r.renewalDateISO, null);
  assert.equal(r.renewalDateDisplay, 'Annually');
});

test('classifyRenewal: unparseable free text falls back to the term, never "missing"', () => {
  const r = classifyRenewal({ renewalType: 'Fixed Date', rawDate: 'See Notes', length: 'Annually', now: NOW });
  assert.equal(r.renewalClass, 'undated-by-design');
  assert.equal(r.renewalDateDisplay, 'Annually');
});

test('classifyRenewal: never emits the legacy "TBD" sentinel', () => {
  const r = classifyRenewal({ renewalType: '', rawDate: '', length: '', now: NOW });
  assert.notEqual(r.renewalDateDisplay, 'TBD');
  assert.equal(r.renewalDateDisplay, '');
});
