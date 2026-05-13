import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import {
  IconAlertCircle,
  IconCalendarClock,
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconMailForward,
  IconRefresh,
  IconShieldCheck,
} from '@tabler/icons-react';
import {
  DomainVerificationStatus,
  EmailLogEntry,
  EmailLogSummary,
  ReminderState,
} from '../types';
import {
  fetchDomainStatus,
  fetchEmailLog,
  fetchReminderState,
  runReminderPass,
  sendTestEmail,
  TokenProvider,
} from '../services/emailAdminApi';
import { useToast } from '../components/ToastProvider';
import { getSuperAdminEmail } from '../auth/superAdmin';

const DEV_AUTH_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true';

function useAccessTokenProvider(): TokenProvider {
  const { oktaAuth } = useOktaAuth();
  return useCallback(async () => {
    if (DEV_AUTH_BYPASS) {
      return (import.meta.env.VITE_DEV_ACCESS_TOKEN as string) || 'dev-bypass-token';
    }
    const token = oktaAuth.getAccessToken();
    return token || null;
  }, [oktaAuth]);
}

interface DomainPanelProps {
  status: DomainVerificationStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function statusTone(status: string): { text: string; tone: 'good' | 'warn' | 'bad' | 'muted' } {
  switch (status) {
    case 'Verified':
      return { text: 'Verified', tone: 'good' };
    case 'VerificationFailed':
    case 'Failed':
      return { text: 'Failed', tone: 'bad' };
    case 'VerificationRequested':
    case 'Pending':
      return { text: 'Pending', tone: 'warn' };
    default:
      return { text: status || 'Unknown', tone: 'muted' };
  }
}

const toneClasses: Record<'good' | 'warn' | 'bad' | 'muted', string> = {
  good: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

function DomainPanel({ status, loading, error, onRefresh }: DomainPanelProps): React.ReactElement {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <IconShieldCheck size={18} className="text-sidebar-primary" />
          <h2 className="text-sm font-semibold text-foreground">Sender domain verification</h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border border-border hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
          Refresh
        </button>
      </header>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          <IconAlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {!status && !error && (
        <p className="text-[12px] text-muted-foreground">
          {loading ? 'Reading sender-domain status from Azure…' : 'No status loaded yet.'}
        </p>
      )}

      {status && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
            <Info label="Domain" value={status.domainName} mono />
            <Info label="Sender address" value={status.senderAddress || '—'} mono />
            <Info label="From sender domain" value={status.fromSenderDomain || '—'} mono />
            <Info label="Mail-from domain" value={status.mailFromSenderDomain || '—'} mono />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Overall</span>
            <Badge tone={statusTone(status.overall).tone}>{statusTone(status.overall).text}</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Record</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {status.checks.map((check) => {
                  const tone = statusTone(check.status);
                  return (
                    <tr key={check.record} className="border-t border-border">
                      <td className="py-2 pr-3 font-semibold">{check.record}</td>
                      <td className="py-2 pr-3"><Badge tone={tone.tone}>{tone.text}</Badge></td>
                      <td className="py-2 pr-3 text-muted-foreground">{check.recordType || '—'}</td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground truncate max-w-[180px]" title={check.recordName || ''}>
                        {check.recordName || '—'}
                      </td>
                      <td className="py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[260px]" title={check.recordValue || ''}>
                        {check.recordValue || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

interface InfoProps {
  label: string;
  value: string;
  mono?: boolean;
}

function Info({ label, value, mono }: InfoProps): React.ReactElement {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-[12px] text-foreground ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

interface BadgeProps {
  tone: 'good' | 'warn' | 'bad' | 'muted';
  children: React.ReactNode;
}

function Badge({ tone, children }: BadgeProps): React.ReactElement {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

interface TestSendPanelProps {
  defaultRecipient: string;
  getAccessToken: TokenProvider;
  onSent: () => void;
}

function TestSendPanel({ defaultRecipient, getAccessToken, onSent }: TestSendPanelProps): React.ReactElement {
  const [to, setTo] = useState(defaultRecipient);
  const [subject, setSubject] = useState('Application Tracker — test send');
  const [message, setMessage] = useState('Confirming the renewal-reminder pipeline is healthy.');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const toast = useToast();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setLastResult(null);
    try {
      const result = await sendTestEmail({ to, subject, message }, { getAccessToken });
      const detail = `Sent to ${result.to}. ACS status: ${result.status || 'queued'}. ` +
        (result.messageId ? `Message id: ${result.messageId}` : '');
      setLastResult({ ok: true, detail });
      toast.success('Test email sent', detail);
      onSent();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Email send failed.';
      setLastResult({ ok: false, detail });
      toast.error('Test email failed', detail);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="flex items-center gap-2 mb-4">
        <IconMailForward size={18} className="text-sidebar-primary" />
        <h2 className="text-sm font-semibold text-foreground">Send a test email</h2>
      </header>
      <form onSubmit={submit} className="space-y-3 text-[12px]">
        <Field label="To">
          <input
            type="email"
            required
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-[12px] focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
            placeholder="recipient@atlantafinehomes.com"
          />
        </Field>
        <Field label="Subject">
          <input
            type="text"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-[12px] focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
          />
        </Field>
        <Field label="Message">
          <textarea
            required
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground text-[12px] focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
          />
        </Field>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Goes through ACS using <code className="font-mono">ACS_SENDER_ADDRESS</code>. Logged below.
          </p>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-md bg-sidebar-primary px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? <IconLoader2 size={13} className="animate-spin" /> : <IconMailForward size={13} />}
            {sending ? 'Sending…' : 'Send test'}
          </button>
        </div>
        {lastResult && (
          <div className={`mt-1 rounded-md border px-2.5 py-1.5 text-[11px] ${
            lastResult.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}>
            {lastResult.detail}
          </div>
        )}
      </form>
    </section>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps): React.ReactElement {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

interface LogPanelProps {
  entries: EmailLogEntry[];
  summary: EmailLogSummary | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function LogPanel({ entries, summary, loading, error, onRefresh }: LogPanelProps): React.ReactElement {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Email send log</h2>
          {summary && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.totalSends} total · {summary.successCount} sent · {summary.failureCount} failed
              {summary.lastSendAt ? ` · last at ${new Date(summary.lastSendAt).toLocaleString()}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border border-border hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
          Refresh
        </button>
      </header>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          <IconAlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {entries.length === 0 && !error && (
        <p className="text-[12px] text-muted-foreground">
          {loading ? 'Loading…' : 'No emails recorded yet. Send a test above to verify the pipeline.'}
        </p>
      )}

      {entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Sent at</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">To</th>
                <th className="py-2 pr-3 font-medium">Subject</th>
                <th className="py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const sent = entry.status === 'sent' || entry.status === 'Succeeded';
                return (
                  <tr key={entry.id} className="border-t border-border align-top">
                    <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 capitalize">{entry.type}</td>
                    <td className="py-2 pr-3">
                      {sent
                        ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><IconCircleCheck size={13} /> {entry.status}</span>
                        : <span className="inline-flex items-center gap-1 text-destructive"><IconCircleX size={13} /> {entry.status}</span>}
                    </td>
                    <td className="py-2 pr-3 truncate max-w-[200px]" title={entry.to}>{entry.to}</td>
                    <td className="py-2 pr-3 truncate max-w-[260px]" title={entry.subject}>{entry.subject}</td>
                    <td className="py-2 text-muted-foreground text-[11px]">
                      {entry.errorMessage
                        ? <span className="text-destructive">{entry.errorMessage}</span>
                        : entry.messageId
                          ? <span className="font-mono">{entry.messageId.slice(0, 16)}…</span>
                          : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface RemindersPanelProps {
  state: ReminderState | null;
  loading: boolean;
  running: boolean;
  error: string | null;
  onRefresh: () => void;
  onRun: () => void;
}

function RemindersPanel({ state, loading, running, error, onRefresh, onRun }: RemindersPanelProps): React.ReactElement {
  const last = state?.lastRunResult;
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <IconCalendarClock size={18} className="text-sidebar-primary" />
          <h2 className="text-sm font-semibold text-foreground">Renewal reminders</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || running}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border border-border hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
            Refresh
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-md bg-sidebar-primary px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {running ? <IconLoader2 size={12} className="animate-spin" /> : <IconCalendarClock size={12} />}
            {running ? 'Running…' : 'Run reminders now'}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          <IconAlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {!state?.lastRunAt && !error && (
        <p className="text-[12px] text-muted-foreground">
          {loading ? 'Loading…' : 'No reminder pass has run yet. Click Run reminders now to trigger one immediately.'}
        </p>
      )}

      {last && (
        <div className="space-y-3 text-[12px]">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="Scanned" value={last.scanned} />
            <Stat label="Matched" value={last.matched} />
            <Stat label="Sent" value={last.sent} tone="good" />
            <Stat label="Skipped" value={last.skipped} tone="muted" />
            <Stat label="Failed" value={last.failed} tone={last.failed ? 'bad' : 'muted'} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Last run: {new Date(last.endedAt || last.startedAt).toLocaleString()} ({last.reason})
          </p>
          {last.failures.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive space-y-1">
              <div className="font-semibold">Failures:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {last.failures.slice(0, 5).map((f, i) => (
                  <li key={i}>
                    <span className="font-mono">{f.licenseId}</span> → {f.to} ({f.daysUntilRenewal}d): {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

interface StatProps {
  label: string;
  value: number;
  tone?: 'good' | 'bad' | 'muted';
}

function Stat({ label, value, tone = 'muted' }: StatProps): React.ReactElement {
  const cls = tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'bad'
      ? 'text-destructive'
      : 'text-foreground';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

const Settings: React.FC = () => {
  const getAccessToken = useAccessTokenProvider();
  const [status, setStatus] = useState<DomainVerificationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [logEntries, setLogEntries] = useState<EmailLogEntry[]>([]);
  const [logSummary, setLogSummary] = useState<EmailLogSummary | null>(null);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);

  const [reminderState, setReminderState] = useState<ReminderState | null>(null);
  const [reminderLoading, setReminderLoading] = useState(true);
  const [reminderRunning, setReminderRunning] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const toast = useToast();
  const abortRefs = useRef<{ status?: AbortController; log?: AbortController; reminders?: AbortController }>({});

  const loadStatus = useCallback(async () => {
    abortRefs.current.status?.abort();
    const controller = new AbortController();
    abortRefs.current.status = controller;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const result = await fetchDomainStatus({ getAccessToken, signal: controller.signal });
      setStatus(result.status);
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus(null);
      setStatusError(error instanceof Error ? error.message : 'Failed to load domain status.');
    } finally {
      if (!controller.signal.aborted) setStatusLoading(false);
    }
  }, [getAccessToken]);

  const loadLog = useCallback(async () => {
    abortRefs.current.log?.abort();
    const controller = new AbortController();
    abortRefs.current.log = controller;
    setLogLoading(true);
    setLogError(null);
    try {
      const result = await fetchEmailLog(100, { getAccessToken, signal: controller.signal });
      setLogEntries(result.entries);
      setLogSummary(result.summary);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLogError(error instanceof Error ? error.message : 'Failed to read email log.');
    } finally {
      if (!controller.signal.aborted) setLogLoading(false);
    }
  }, [getAccessToken]);

  const loadReminders = useCallback(async () => {
    abortRefs.current.reminders?.abort();
    const controller = new AbortController();
    abortRefs.current.reminders = controller;
    setReminderLoading(true);
    setReminderError(null);
    try {
      const result = await fetchReminderState({ getAccessToken, signal: controller.signal });
      setReminderState(result);
    } catch (error) {
      if (controller.signal.aborted) return;
      setReminderError(error instanceof Error ? error.message : 'Failed to read reminder state.');
    } finally {
      if (!controller.signal.aborted) setReminderLoading(false);
    }
  }, [getAccessToken]);

  const runReminders = useCallback(async () => {
    setReminderRunning(true);
    setReminderError(null);
    try {
      const summary = await runReminderPass({ getAccessToken });
      setReminderState({ lastRunAt: summary.endedAt, lastRunResult: summary });
      toast.success(
        'Reminder pass complete',
        `${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed out of ${summary.matched} matched.`,
      );
      void loadLog();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reminder pass failed.';
      setReminderError(message);
      toast.error('Reminder pass failed', message);
    } finally {
      setReminderRunning(false);
    }
  }, [getAccessToken, loadLog, toast]);

  useEffect(() => {
    void loadStatus();
    void loadLog();
    void loadReminders();
    return () => {
      abortRefs.current.status?.abort();
      abortRefs.current.log?.abort();
      abortRefs.current.reminders?.abort();
    };
  }, [loadStatus, loadLog, loadReminders]);

  const defaultRecipient = useMemo(() => getSuperAdminEmail(), []);

  return (
    <div className="px-6 py-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-display">Settings · Email</h1>
        <p className="text-[12px] text-muted-foreground mt-1">
          Verify the sender domain, send a test message, and review every email the proxy has dispatched.
        </p>
      </div>

      <DomainPanel
        status={status}
        loading={statusLoading}
        error={statusError}
        onRefresh={() => void loadStatus()}
      />

      <TestSendPanel
        defaultRecipient={defaultRecipient}
        getAccessToken={getAccessToken}
        onSent={() => void loadLog()}
      />

      <RemindersPanel
        state={reminderState}
        loading={reminderLoading}
        running={reminderRunning}
        error={reminderError}
        onRefresh={() => void loadReminders()}
        onRun={() => void runReminders()}
      />

      <LogPanel
        entries={logEntries}
        summary={logSummary}
        loading={logLoading}
        error={logError}
        onRefresh={() => void loadLog()}
      />
    </div>
  );
};

export default Settings;
