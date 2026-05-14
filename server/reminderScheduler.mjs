import { promises as fs } from 'node:fs';
import path from 'node:path';
import { readEmailLog } from './emailLog.mjs';

const STATE_FILENAME = 'reminder-state.json';
const DEFAULT_PROD_DIR = '/home/data';
const DEFAULT_DEV_DIR = path.join(process.cwd(), 'data');
// Pre-renewal nudges at quarter (90), bi-monthly (60), monthly (30), two-week,
// one-week, and last-day marks. Overdue escalations at 1, 30, 60, 90 days past
// the date in Monday. Override with REMINDER_TRIGGER_DAYS=90,60,30,...
const DEFAULT_TRIGGERS = [90, 60, 30, 14, 7, 1, -1, -30, -60, -90];
const DEFAULT_RUN_HOUR_UTC = 13; // 9am ET ~ 13:00 UTC during DST
const DAY_MS = 24 * 60 * 60 * 1000;

function resolveStateDir() {
  if (process.env.EMAIL_LOG_DIR) return process.env.EMAIL_LOG_DIR;
  if (process.env.NODE_ENV === 'production') return DEFAULT_PROD_DIR;
  return DEFAULT_DEV_DIR;
}

function resolveStatePath() {
  return path.join(resolveStateDir(), STATE_FILENAME);
}

async function readState() {
  const filePath = resolveStatePath();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // missing file or malformed -> fresh state
  }
  return { lastRunAt: null, lastRunResult: null };
}

async function writeState(state) {
  const filePath = resolveStatePath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('[reminders] failed to persist state:', error?.message || error);
  }
}

function parseReminderTriggers() {
  const raw = process.env.REMINDER_TRIGGER_DAYS;
  if (!raw) return DEFAULT_TRIGGERS;
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function getRunHourUtc() {
  const raw = Number(process.env.REMINDER_RUN_HOUR_UTC);
  return Number.isFinite(raw) && raw >= 0 && raw <= 23 ? raw : DEFAULT_RUN_HOUR_UTC;
}

export function daysUntilDate(renewalDate, now = new Date()) {
  if (!renewalDate) return null;
  const target = new Date(renewalDate);
  if (Number.isNaN(target.getTime())) return null;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startOfTarget = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((startOfTarget - startOfToday) / DAY_MS);
}

// Renewal types that should never trigger reminders, even when a date is set.
// Kept in sync with NON_FIRING_RENEWAL_TYPES in mondayProxy.mjs.
const NON_FIRING_TYPES = new Set([
  'Until Cancelled',
  'Month-to-month',
  'One-time',
  'Externally Managed',
  'Pending',
]);

export function selectLicensesForReminder(licenses, triggerDays, now = new Date()) {
  const triggerSet = new Set(triggerDays);
  const matches = [];
  for (const license of licenses) {
    if (license.renewalType && NON_FIRING_TYPES.has(license.renewalType)) continue;
    const days = daysUntilDate(license.renewalDate, now);
    if (days == null) continue;
    if (!triggerSet.has(days)) continue;
    matches.push({ license, daysUntilRenewal: days });
  }
  return matches;
}

function alreadySentRecently(logEntries, licenseId, daysUntilRenewal, recipient, now = new Date()) {
  const cutoff = now.getTime() - DAY_MS;
  const normalizedRecipient = (recipient || '').trim().toLowerCase();
  return logEntries.some((entry) => {
    if (entry.type !== 'reminder') return false;
    if (entry.licenseId !== licenseId) return false;
    if (entry.daysUntilRenewal !== daysUntilRenewal) return false;
    if ((entry.to || '').trim().toLowerCase() !== normalizedRecipient) return false;
    if (entry.status !== 'sent' && entry.status !== 'Succeeded') return false;
    return new Date(entry.timestamp).getTime() > cutoff;
  });
}

/**
 * Run a single reminder pass.
 * @param {{
 *   loadLicenses: () => Promise<Array<{ id:string, renewalDate?:string }>>,
 *   resolveRecipients: (license:any) => string[],
 *   sendReminder: (input:{to:string, license:any, daysUntilRenewal:number}) => Promise<any>,
 *   triggerDays?: number[],
 *   now?: Date,
 *   reason?: string,
 * }} deps
 */
export async function runReminderPass(deps) {
  const triggers = deps.triggerDays || parseReminderTriggers();
  const now = deps.now || new Date();
  const startedAt = now.toISOString();

  const licenses = await deps.loadLicenses();
  const due = selectLicensesForReminder(licenses, triggers, now);

  const { entries: recentLog } = await readEmailLog({ limit: 500 });

  const summary = {
    startedAt,
    endedAt: null,
    reason: deps.reason || 'scheduled',
    scanned: licenses.length,
    matched: due.length,
    attempted: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  for (const { license, daysUntilRenewal } of due) {
    const recipients = deps.resolveRecipients(license);
    if (!recipients.length) {
      summary.skipped += 1;
      continue;
    }
    for (const to of recipients) {
      if (alreadySentRecently(recentLog, license.id, daysUntilRenewal, to, now)) {
        summary.skipped += 1;
        continue;
      }
      summary.attempted += 1;
      try {
        await deps.sendReminder({ to, license, daysUntilRenewal });
        summary.sent += 1;
      } catch (error) {
        summary.failed += 1;
        summary.failures.push({
          licenseId: license.id,
          to,
          daysUntilRenewal,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  summary.endedAt = new Date().toISOString();
  await writeState({ lastRunAt: summary.endedAt, lastRunResult: summary });
  return summary;
}

export async function getReminderState() {
  return readState();
}

let intervalHandle = null;
let running = false;

export function startReminderInterval(runDeps) {
  if (intervalHandle) return intervalHandle;
  const runHour = getRunHourUtc();

  const tick = async () => {
    if (running) return;
    const now = new Date();
    const state = await readState();
    const lastIso = state.lastRunAt;
    const lastDate = lastIso ? new Date(lastIso) : null;
    const isRunHour = now.getUTCHours() === runHour;
    const sameDay = lastDate
      && lastDate.getUTCFullYear() === now.getUTCFullYear()
      && lastDate.getUTCMonth() === now.getUTCMonth()
      && lastDate.getUTCDate() === now.getUTCDate();
    if (!isRunHour || sameDay) return;

    running = true;
    try {
      await runReminderPass({ ...runDeps, reason: 'scheduled' });
    } catch (error) {
      console.error('[reminders] scheduled pass crashed:', error?.message || error);
    } finally {
      running = false;
    }
  };

  intervalHandle = setInterval(() => { void tick(); }, 5 * 60 * 1000);
  // Fire one check shortly after boot so a restart inside the run hour still triggers.
  setTimeout(() => { void tick(); }, 30_000).unref?.();
  return intervalHandle;
}

export function stopReminderIntervalForTest() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
