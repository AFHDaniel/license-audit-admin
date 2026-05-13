import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRenewalReminder, renderAdminTest, urgencyTier } from './emailTemplate.mjs';

const sampleLicense = {
  id: 'lic-1',
  application: 'Slack Business+',
  vendor: 'Slack Technologies',
  department: 'Operations',
  renewalDate: '2026-06-12',
  renewalMethod: 'ACH',
  amount: 24000,
  seats: '120',
};

test('urgencyTier maps day counts to tiers', () => {
  assert.equal(urgencyTier(-2), 'overdue');
  assert.equal(urgencyTier(0), 'overdue');
  assert.equal(urgencyTier(1), 'critical');
  assert.equal(urgencyTier(7), 'critical');
  assert.equal(urgencyTier(8), 'high');
  assert.equal(urgencyTier(14), 'high');
  assert.equal(urgencyTier(15), 'medium');
  assert.equal(urgencyTier(30), 'medium');
  assert.equal(urgencyTier(31), 'info');
  assert.equal(urgencyTier(null), 'info');
});

test('renderRenewalReminder produces subject + plain text + html for a 30-day notice', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: 30 });
  assert.match(result.subject, /Renewal notice: Slack Business\+/);
  assert.match(result.subject, /30 days/);
  assert.match(result.plainText, /Slack Business\+/);
  assert.match(result.plainText, /Operations/);
  assert.match(result.plainText, /\$24,000/);
  assert.match(result.plainText, /applications\.atlantafinehomes\.com\/license\/lic-1/);
  assert.match(result.html, /<!DOCTYPE html>/);
  assert.match(result.html, /Slack Business/);
  assert.match(result.html, /RENEWS IN 30 DAYS/);
  assert.match(result.html, /Review in Application Tracker/);
});

test('renderRenewalReminder marks a 5-day reminder as critical and changes the subject prefix', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: 5 });
  assert.match(result.subject, /^Action needed:/);
  assert.match(result.subject, /5 days/);
  assert.match(result.html, /RENEWS IN 5 DAYS/);
});

test('renderRenewalReminder marks overdue licenses with the OVERDUE label and warns about lapsing', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: -3 });
  assert.match(result.subject, /^OVERDUE:/);
  assert.match(result.html, /OVERDUE BY 3 DAYS/);
  assert.match(result.plainText, /3 days ago/);
});

test('renderRenewalReminder escapes user-supplied strings to prevent HTML injection', () => {
  const evil = {
    ...sampleLicense,
    application: 'Slack<script>alert(1)</script>',
    vendor: '">injected',
  };
  const result = renderRenewalReminder({ license: evil, daysUntilRenewal: 14 });
  assert.ok(!result.html.includes('<script>'), 'script tag must be escaped');
  assert.ok(result.html.includes('&lt;script&gt;'), 'script tag should appear escaped');
  assert.ok(!result.html.includes('">injected'), 'attribute injection must be neutralized');
});

test('renderRenewalReminder formats missing fields gracefully', () => {
  const sparse = { id: 'x', application: 'Mystery App' };
  const result = renderRenewalReminder({ license: sparse, daysUntilRenewal: 10 });
  assert.match(result.plainText, /Department: Unassigned/);
  assert.match(result.plainText, /Date not set/);
  assert.match(result.plainText, /Not on file/);
});

test('renderRenewalReminder supports a custom detailUrl', () => {
  const result = renderRenewalReminder({
    license: sampleLicense,
    daysUntilRenewal: 14,
    detailUrl: 'https://example.com/preview',
  });
  assert.match(result.plainText, /https:\/\/example\.com\/preview/);
  assert.match(result.html, /https:\/\/example\.com\/preview/);
});

test('renderAdminTest renders the brand-styled test shell', () => {
  const result = renderAdminTest({ subject: 'Hello', message: 'Smoke test body', requestedBy: 'daniel@atlantafinehomes.com' });
  assert.equal(result.subject, 'Hello');
  assert.match(result.plainText, /Smoke test body/);
  assert.match(result.plainText, /daniel@atlantafinehomes\.com/);
  assert.match(result.html, /Atlanta Fine Homes/);
  assert.match(result.html, /Smoke test body/);
});
