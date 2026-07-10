import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRenewalReminder, renderAdminTest, reminderStage, urgencyTier } from './emailTemplate.mjs';

const sampleLicense = {
  id: 'lic-1',
  application: 'Slack Business+',
  vendor: 'Slack Technologies',
  department: 'Operations',
  renewalDate: '2026-06-12',
  renewalMethod: 'ACH',
  amount: 24000,
  length: 'Annual',
  seats: '120',
};

test('reminderStage maps day counts to the five-stage cadence', () => {
  assert.equal(reminderStage(120), '90-day');
  assert.equal(reminderStage(90), '90-day');
  assert.equal(reminderStage(61), '90-day');
  assert.equal(reminderStage(60), '60-day');
  assert.equal(reminderStage(31), '60-day');
  assert.equal(reminderStage(30), '30-day');
  assert.equal(reminderStage(1), '30-day');
  assert.equal(reminderStage(0), 'expiration');
  assert.equal(reminderStage(-1), 'post-expiration');
  assert.equal(reminderStage(-90), 'post-expiration');
  assert.equal(reminderStage(null), 'expiration');
});

test('urgencyTier remains exported for backward compatibility', () => {
  assert.equal(urgencyTier(-90), 'overdue-severe');
  assert.equal(urgencyTier(0), 'critical');
  assert.equal(urgencyTier(90), 'planning');
  assert.equal(urgencyTier(null), 'info');
});

test('90-day reminder is a friendly heads-up that mentions negotiating', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: 90 });
  assert.match(result.subject, /^Heads-up: Slack Business\+/);
  assert.match(result.subject, /90 days/);
  assert.match(result.html, /RENEWS IN 90 DAYS/);
  assert.match(result.html, /A good time to:/);
  assert.match(result.plainText, /negotiate pricing/);
});

test('60-day reminder nudges toward a pricing review', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: 45 });
  assert.match(result.subject, /^Renewal in 2 months: Slack Business\+/);
  assert.match(result.html, /RENEWS IN 45 DAYS/);
  assert.match(result.plainText, /Worth checking before it renews/);
});

test('30-day reminder is action-oriented', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: 20 });
  assert.match(result.subject, /^\[ACTION REQUIRED\] Slack Business\+ renews in 30 days/);
  assert.match(result.html, /RENEWS IN 20 DAYS &middot; ACTION NEEDED|RENEWS IN 20 DAYS . ACTION NEEDED/);
  assert.match(result.plainText, /already handled the renewal/);
});

test('expiration reminder fires on the renewal date', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: 0 });
  assert.match(result.subject, /^\[ACTION REQUIRED\] Slack Business\+ renews today/);
  assert.match(result.html, /RENEWS TODAY/);
  assert.match(result.plainText, /renews today/);
});

test('post-expiration reminder asks to refresh the record', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: -45 });
  assert.match(result.subject, /^\[ACTION REQUIRED\] Slack Business\+ is past its renewal date/);
  assert.match(result.html, /45 DAYS PAST DUE/);
  assert.match(result.plainText, /you are the source of truth/);
});

test('an explicit stage override bypasses the day-count mapping', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: 5, stage: '90-day' });
  assert.match(result.subject, /^Heads-up:/);
});

test('every reminder carries the how-to-update block and CTA', () => {
  for (const days of [90, 45, 20, 0, -30]) {
    const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: days });
    assert.match(result.html, /Update it in under a minute/, `update steps missing for day ${days}`);
    assert.match(result.html, /Open in Application Tracker/, `CTA missing for day ${days}`);
  }
});

test('reminders show normalized monthly and annual cost', () => {
  const result = renderRenewalReminder({ license: sampleLicense, daysUntilRenewal: 30 });
  // $24,000 billed annually => $2,000/mo
  assert.match(result.plainText, /\$2,000\/mo/);
  assert.match(result.plainText, /\$24,000\/yr/);
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
