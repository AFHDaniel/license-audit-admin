import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  daysUntilDate,
  selectLicensesForReminder,
  runReminderPass,
} from './reminderScheduler.mjs';
import { appendEmailLog, buildEmailLogEntry } from './emailLog.mjs';

function isoDaysFromNow(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

test('daysUntilDate counts whole UTC days between today and target', () => {
  const now = new Date('2026-05-13T18:00:00Z');
  assert.equal(daysUntilDate('2026-05-13', now), 0);
  assert.equal(daysUntilDate('2026-05-20', now), 7);
  assert.equal(daysUntilDate('2026-05-10', now), -3);
  assert.equal(daysUntilDate(undefined, now), null);
  assert.equal(daysUntilDate('garbage', now), null);
});

test('selectLicensesForReminder picks only licenses whose days match a trigger', () => {
  const now = new Date('2026-05-13T18:00:00Z');
  const licenses = [
    { id: 'a', renewalDate: isoDaysFromNow(30, now) },
    { id: 'b', renewalDate: isoDaysFromNow(15, now) },
    { id: 'c', renewalDate: isoDaysFromNow(7, now) },
    { id: 'd', renewalDate: '' },
  ];
  const result = selectLicensesForReminder(licenses as never[], [30, 14, 7], now);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((r) => r.license.id).sort(), ['a', 'c']);
});

test('selectLicensesForReminder skips licenses with non-firing renewal types', () => {
  const now = new Date('2026-05-13T18:00:00Z');
  const licenses = [
    { id: 'fire', renewalDate: isoDaysFromNow(30, now), renewalType: 'Fixed Date' },
    { id: 'autoRenew', renewalDate: isoDaysFromNow(30, now), renewalType: 'Auto-renew' },
    { id: 'untilCancelled', renewalDate: isoDaysFromNow(30, now), renewalType: 'Until Cancelled' },
    { id: 'monthly', renewalDate: isoDaysFromNow(30, now), renewalType: 'Month-to-month' },
    { id: 'oneTime', renewalDate: isoDaysFromNow(30, now), renewalType: 'One-time' },
    { id: 'msp', renewalDate: isoDaysFromNow(30, now), renewalType: 'Externally Managed' },
    { id: 'pending', renewalDate: isoDaysFromNow(30, now), renewalType: 'Pending' },
  ];
  const result = selectLicensesForReminder(licenses as never[], [30], now);
  assert.deepEqual(result.map((r) => r.license.id).sort(), ['autoRenew', 'fire']);
});

test('selectLicensesForReminder fires on negative days for overdue escalations', () => {
  const now = new Date('2026-05-13T18:00:00Z');
  const licenses = [
    { id: 'p90', renewalDate: isoDaysFromNow(90, now) },
    { id: 'p60', renewalDate: isoDaysFromNow(60, now) },
    { id: 'd0', renewalDate: isoDaysFromNow(0, now) },
    { id: 'm30', renewalDate: isoDaysFromNow(-30, now) },
    { id: 'm60', renewalDate: isoDaysFromNow(-60, now) },
    { id: 'm90', renewalDate: isoDaysFromNow(-90, now) },
    { id: 'm91', renewalDate: isoDaysFromNow(-91, now) },
  ];
  const result = selectLicensesForReminder(licenses as never[], [90, 60, 1, -1, -30, -60, -90], now);
  assert.deepEqual(
    result.map((r) => r.license.id).sort(),
    ['m30', 'm60', 'm90', 'p60', 'p90'],
  );
});

test('runReminderPass sends to each recipient and dedupes against the recent log', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'afh-rem-'));
  process.env.EMAIL_LOG_DIR = tmpDir;
  const now = new Date('2026-05-13T18:00:00Z');

  // Pretend we already sent a reminder for license A / 7 days, an hour ago.
  await appendEmailLog(
    buildEmailLogEntry({
      type: 'reminder',
      to: 'beth@x.com',
      subject: 'sent already',
      sender: 'me',
      status: 'sent',
      licenseId: 'A',
      daysUntilRenewal: 7,
    }),
  );

  const licenses = [
    { id: 'A', renewalDate: isoDaysFromNow(7, now), department: 'IT', application: 'Slack' },
    { id: 'B', renewalDate: isoDaysFromNow(30, now), department: 'Accounting', application: 'NetSuite' },
  ];

  const sent: { to: string; licenseId: string; days: number }[] = [];

  const summary = await runReminderPass({
    loadLicenses: async () => licenses as never[],
    resolveRecipients: (license: { id: string }) =>
      license.id === 'A' ? ['beth@x.com', 'andrea@x.com'] : ['jp@x.com'],
    sendReminder: async ({ to, license, daysUntilRenewal }) => {
      sent.push({ to, licenseId: license.id, days: daysUntilRenewal });
    },
    triggerDays: [30, 14, 7],
    now,
    reason: 'test',
  });

  assert.equal(summary.matched, 2);
  assert.equal(summary.sent, 2); // beth (skip) + andrea + jp
  assert.equal(summary.skipped, 1);
  assert.deepEqual(
    sent.sort((a, b) => a.to.localeCompare(b.to)),
    [
      { to: 'andrea@x.com', licenseId: 'A', days: 7 },
      { to: 'jp@x.com', licenseId: 'B', days: 30 },
    ],
  );
});

test('runReminderPass records failures without aborting the whole pass', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'afh-rem-'));
  process.env.EMAIL_LOG_DIR = tmpDir;
  const now = new Date('2026-05-13T18:00:00Z');

  const licenses = [
    { id: 'X', renewalDate: isoDaysFromNow(14, now), application: 'A' },
    { id: 'Y', renewalDate: isoDaysFromNow(14, now), application: 'B' },
  ];

  const summary = await runReminderPass({
    loadLicenses: async () => licenses as never[],
    resolveRecipients: () => ['a@x.com'],
    sendReminder: async ({ license }) => {
      if (license.id === 'X') throw new Error('acs blew up');
    },
    triggerDays: [14],
    now,
    reason: 'test',
  });

  assert.equal(summary.matched, 2);
  assert.equal(summary.sent, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.failures[0].licenseId, 'X');
  assert.match(summary.failures[0].message, /acs blew up/);
});
