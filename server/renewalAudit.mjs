import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const AUDIT_FILENAME = 'renewal-audit.jsonl';
const DEFAULT_PROD_DIR = '/home/data';
const DEFAULT_DEV_DIR = path.join(process.cwd(), 'data');
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const ROTATED_SUFFIX = '.1';

function resolveDir() {
  if (process.env.EMAIL_LOG_DIR) return process.env.EMAIL_LOG_DIR;
  if (process.env.NODE_ENV === 'production') return DEFAULT_PROD_DIR;
  return DEFAULT_DEV_DIR;
}

export function resolveAuditPath() {
  return path.join(resolveDir(), AUDIT_FILENAME);
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
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

/**
 * Append a single renewal-audit JSONL entry.
 *
 * Fields:
 *   id          - uuid for this audit row
 *   timestamp   - ISO8601
 *   actorEmail  - Okta-verified email of the user who triggered the write
 *   itemId      - Monday item id
 *   boardId     - Monday board id
 *   fields      - which Monday columns were targeted
 *   requested   - raw fields the client asked us to write
 *   before      - normalized snapshot of the license before the write
 *   after       - normalized snapshot of the license after the write
 */
export async function appendRenewalAuditEntry(input, options = {}) {
  const filePath = options.filePath || resolveAuditPath();
  const entry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    actorEmail: input.actorEmail || null,
    itemId: input.itemId,
    boardId: input.boardId,
    fields: Array.isArray(input.fields) ? input.fields : [],
    requested: input.requested ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
  };
  await ensureDir(filePath);
  await rotateIfNeeded(filePath);
  // appendFile on Linux is atomic for writes < PIPE_BUF (4096 bytes). Each
  // entry comfortably fits, so concurrent writers don't interleave lines.
  await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

export async function readRenewalAudit({ limit = 100, filePath } = {}) {
  const resolved = filePath || resolveAuditPath();
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
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed && typeof parsed === 'object' && parsed.id) entries.push(parsed);
    } catch {
      // skip malformed line; rare and we don't want to fail the whole read
    }
  }
  return { entries, total: lines.length };
}
