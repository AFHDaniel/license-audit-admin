import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { appendEmailLog, readEmailLog, buildEmailLogEntry, summarizeEmailLog } from './emailLog.mjs';

async function makeTempLogPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'afh-email-log-'));
  return path.join(dir, 'email-log.jsonl');
}

test('buildEmailLogEntry produces a structured entry with required fields', () => {
  const entry = buildEmailLogEntry({
    type: 'test',
    to: 'daniel@atlantafinehomes.com',
    subject: 'Hello',
    sender: 'no-reply@applications.atlantafinehomes.com',
    status: 'sent',
    messageId: 'msg-1',
    requestedBy: 'daniel@atlantafinehomes.com',
  });
  assert.equal(entry.type, 'test');
  assert.equal(entry.to, 'daniel@atlantafinehomes.com');
  assert.equal(entry.status, 'sent');
  assert.equal(entry.errorMessage, null);
  assert.ok(entry.id);
  assert.ok(entry.timestamp);
});

test('appendEmailLog writes JSONL lines that readEmailLog returns newest-first', async () => {
  const filePath = await makeTempLogPath();
  const first = buildEmailLogEntry({ type: 'test', to: 'a@x.com', subject: 's1', sender: 'me', status: 'sent' });
  const second = buildEmailLogEntry({ type: 'reminder', to: 'b@x.com', subject: 's2', sender: 'me', status: 'failed', errorMessage: 'nope' });
  await appendEmailLog(first, { filePath });
  await appendEmailLog(second, { filePath });

  const { entries, total } = await readEmailLog({ filePath, limit: 10 });
  assert.equal(total, 2);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, second.id);
  assert.equal(entries[1].id, first.id);
});

test('readEmailLog returns empty when the log file does not exist', async () => {
  const filePath = await makeTempLogPath();
  const result = await readEmailLog({ filePath });
  assert.deepEqual(result, { entries: [], total: 0 });
});

test('readEmailLog tolerates malformed lines without crashing', async () => {
  const filePath = await makeTempLogPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, ['{"not":"valid"', 'totally not json'].join('\n') + '\n', 'utf8');
  const result = await readEmailLog({ filePath });
  assert.equal(result.entries.length, 0);
  assert.equal(result.total, 2);
});

test('summarizeEmailLog counts success/failure and tracks last send timestamp', () => {
  const entries = [
    { id: '1', timestamp: '2026-05-13T10:00:00.000Z', type: 'test', status: 'sent' },
    { id: '2', timestamp: '2026-05-13T11:00:00.000Z', type: 'reminder', status: 'failed' },
    { id: '3', timestamp: '2026-05-13T12:00:00.000Z', type: 'reminder', status: 'sent' },
  ];
  const summary = summarizeEmailLog(entries);
  assert.equal(summary.totalSends, 3);
  assert.equal(summary.successCount, 2);
  assert.equal(summary.failureCount, 1);
  assert.equal(summary.byType.test, 1);
  assert.equal(summary.byType.reminder, 2);
  assert.equal(summary.lastSendAt, '2026-05-13T12:00:00.000Z');
  assert.equal(summary.lastFailureAt, '2026-05-13T11:00:00.000Z');
});
