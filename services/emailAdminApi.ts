import {
  DomainVerificationStatus,
  EmailLogEntry,
  EmailLogSummary,
  ReminderRunSummary,
  ReminderState,
} from '../types';

export type TokenProvider = () => Promise<string | null>;

interface RequestOptions {
  getAccessToken: TokenProvider;
  signal?: AbortSignal;
}

async function authedFetch(path: string, { getAccessToken, signal }: RequestOptions, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Sign in again to access this page.');
  }
  return fetch(path, {
    ...init,
    signal,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === 'string') return data.error;
  } catch {
    // fall through
  }
  return `${fallback} (${res.status})`;
}

export interface TestSendInput {
  to?: string;
  subject?: string;
  message?: string;
}

export interface TestSendResult {
  ok: boolean;
  to: string;
  subject: string;
  sender: string;
  messageId: string | null;
  status: string | null;
}

export async function sendTestEmail(input: TestSendInput, opts: RequestOptions): Promise<TestSendResult> {
  const res = await authedFetch('/api/email/send-test', opts, {
    method: 'POST',
    body: JSON.stringify(input || {}),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to send test email'));
  return res.json();
}

export interface EmailLogResponse {
  ok: boolean;
  total: number;
  entries: EmailLogEntry[];
  summary: EmailLogSummary;
}

export async function fetchEmailLog(limit: number, opts: RequestOptions): Promise<EmailLogResponse> {
  const res = await authedFetch(`/api/email/log?limit=${encodeURIComponent(limit)}`, opts);
  if (!res.ok) throw new Error(await parseError(res, 'Failed to read email log'));
  return res.json();
}

export interface DomainStatusResponse {
  ok: boolean;
  status: DomainVerificationStatus;
}

export interface DomainStatusError {
  error: string;
  missing?: string[];
}

export async function fetchReminderState(opts: RequestOptions): Promise<ReminderState> {
  const res = await authedFetch('/api/email/reminders/state', opts);
  if (!res.ok) throw new Error(await parseError(res, 'Failed to read reminder state'));
  const body = await res.json();
  return { lastRunAt: body.lastRunAt ?? null, lastRunResult: body.lastRunResult ?? null };
}

export async function runReminderPass(opts: RequestOptions): Promise<ReminderRunSummary> {
  const res = await authedFetch('/api/email/reminders/run', opts, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Reminder pass failed'));
  const body = await res.json();
  return body.summary as ReminderRunSummary;
}

export async function fetchDomainStatus(opts: RequestOptions): Promise<DomainStatusResponse> {
  const res = await authedFetch('/api/email/domain-status', opts);
  if (!res.ok) {
    if (res.status === 503) {
      const body = await res.json().catch(() => ({ error: 'Not configured' } as DomainStatusError));
      const missing = Array.isArray((body as DomainStatusError).missing)
        ? ` Missing: ${(body as DomainStatusError).missing!.join(', ')}.`
        : '';
      throw new Error(`${(body as DomainStatusError).error || 'ACS domain status is not configured.'}${missing}`);
    }
    throw new Error(await parseError(res, 'Failed to fetch domain status'));
  }
  return res.json();
}
