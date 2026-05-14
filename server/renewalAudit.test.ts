import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { appendRenewalAuditEntry, readRenewalAudit } from './renewalAudit.mjs';

let tmpDir: string;
let logPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'afh-renewal-audit-'));
  logPath = path.join(tmpDir, 'renewal-audit.jsonl');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('appendRenewalAuditEntry writes a valid JSONL line', async () => {
  const entry = await appendRenewalAuditEntry({
    actorEmail: 'daniel@atlantafinehomes.com',
    itemId: '123',
    boardId: '456',
    fields: ['amount', 'renewalDate'],
    requested: { amount: 100 },
    before: { amount: 50, renewalDate: '2026-01-01' },
    after: { amount: 100, renewalDate: '2026-06-01' },
  }, { filePath: logPath });

  assert.ok(entry.id, 'entry has uuid');
  assert.ok(entry.timestamp, 'entry has timestamp');

  const content = await fs.readFile(logPath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.actorEmail, 'daniel@atlantafinehomes.com');
  assert.equal(parsed.itemId, '123');
  assert.deepEqual(parsed.fields, ['amount', 'renewalDate']);
});

test('readRenewalAudit returns entries newest-first', async () => {
  await appendRenewalAuditEntry({
    actorEmail: 'a@atlantafinehomes.com',
    itemId: '1',
    boardId: 'b1',
    fields: ['amount'],
    requested: { amount: 10 },
    before: null,
    after: null,
  }, { filePath: logPath });
  await appendRenewalAuditEntry({
    actorEmail: 'b@atlantafinehomes.com',
    itemId: '2',
    boardId: 'b1',
    fields: ['seats'],
    requested: { seats: '5' },
    before: null,
    after: null,
  }, { filePath: logPath });

  const { entries, total } = await readRenewalAudit({ filePath: logPath });
  assert.equal(total, 2);
  assert.equal(entries.length, 2);
  // Newest first
  assert.equal(entries[0].itemId, '2');
  assert.equal(entries[1].itemId, '1');
});

test('readRenewalAudit tolerates a malformed last line', async () => {
  await appendRenewalAuditEntry({
    actorEmail: 'a@atlantafinehomes.com',
    itemId: '1',
    boardId: 'b1',
    fields: ['amount'],
    requested: { amount: 10 },
    before: null,
    after: null,
  }, { filePath: logPath });
  await fs.appendFile(logPath, '{ "partial":', 'utf8');

  const { entries } = await readRenewalAudit({ filePath: logPath });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].itemId, '1');
});

test('readRenewalAudit returns empty when file missing', async () => {
  const { entries, total } = await readRenewalAudit({ filePath: path.join(tmpDir, 'nope.jsonl') });
  assert.equal(total, 0);
  assert.equal(entries.length, 0);
});
