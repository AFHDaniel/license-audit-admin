import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const LOG_FILENAME = 'email-log.jsonl';
const DEFAULT_PROD_DIR = '/home/data';
const DEFAULT_DEV_DIR = path.join(process.cwd(), 'data');
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const ROTATED_SUFFIX = '.1';

function resolveLogDir() {
  if (process.env.EMAIL_LOG_DIR) return process.env.EMAIL_LOG_DIR;
  if (process.env.NODE_ENV === 'production') return DEFAULT_PROD_DIR;
  return DEFAULT_DEV_DIR;
}

export function resolveLogPath() {
  return path.join(resolveLogDir(), LOG_FILENAME);
}

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function rotateIfNeeded(filePath) {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size < MAX_LOG_BYTES) return;
    await fs.rename(filePath, filePath + ROTATED_SUFFIX);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function buildEmailLogEntry({
  type,
  to,
  subject,
  sender,
  status,
  messageId = null,
  errorMessage = null,
  requestedBy = null,
  licenseId = null,
  daysUntilRenewal = null,
}) {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    to,
    subject,
    sender,
    status,
    messageId,
    errorMessage,
    requestedBy,
    licenseId,
    daysUntilRenewal,
  };
}

/**
 * Append a single JSONL email log entry.
 * @param {object} entry
 * @param {{ filePath?: string }} [options]
 */
export async function appendEmailLog(entry, options = {}) {
  const filePath = options.filePath || resolveLogPath();
  try {
    await ensureDir(filePath);
    await rotateIfNeeded(filePath);
    await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
  } catch (error) {
    // Logging failures must not break the send path.
    console.error('[emailLog] append failed:', error?.message || error);
  }
}

function parseLogLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.timestamp) {
      return parsed;
    }
  } catch {
    // Skip malformed lines silently — corruption is rare and we don't want one bad
    // line to take down the entire admin view.
  }
  return null;
}

/**
 * Read the most recent email log entries (newest first).
 * @param {{ limit?: number, filePath?: string }} [options]
 */
export async function readEmailLog({ limit = 100, filePath } = {}) {
  const resolved = filePath || resolveLogPath();
  let content = '';
  try {
    content = await fs.readFile(resolved, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { entries: [], total: 0 };
    throw error;
  }

  const lines = content.split('\n').filter(Boolean);
  const entries = [];
  for (let i = lines.length - 1; i >= 0 && entries.length < limit; i -= 1) {
    const parsed = parseLogLine(lines[i]);
    if (parsed) entries.push(parsed);
  }
  return { entries, total: lines.length };
}

export function summarizeEmailLog(entries) {
  const summary = {
    totalSends: entries.length,
    successCount: 0,
    failureCount: 0,
    byType: { test: 0, reminder: 0 },
    lastSendAt: null,
    lastFailureAt: null,
  };
  for (const entry of entries) {
    if (entry.status === 'sent' || entry.status === 'Succeeded') summary.successCount += 1;
    else summary.failureCount += 1;
    if (entry.type && Object.prototype.hasOwnProperty.call(summary.byType, entry.type)) {
      summary.byType[entry.type] += 1;
    }
    if (!summary.lastSendAt || entry.timestamp > summary.lastSendAt) {
      summary.lastSendAt = entry.timestamp;
    }
    if (
      (entry.status !== 'sent' && entry.status !== 'Succeeded') &&
      (!summary.lastFailureAt || entry.timestamp > summary.lastFailureAt)
    ) {
      summary.lastFailureAt = entry.timestamp;
    }
  }
  return summary;
}
