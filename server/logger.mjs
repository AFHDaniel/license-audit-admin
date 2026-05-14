// Lightweight structured logger.
//
// Emits one JSON line per event to stdout (level=info|warn) or stderr
// (level=error). If APPLICATIONINSIGHTS_CONNECTION_STRING is set in the env,
// we lazily import the `applicationinsights` SDK and also pipe each event in.
// The SDK is an optional peer dependency — if it isn't installed, structured
// stdout logging still works and AppInsights is silently skipped.

let appInsightsBridge = null;
let appInsightsLoadAttempted = false;

async function loadAppInsightsBridge() {
  if (appInsightsLoadAttempted) return appInsightsBridge;
  appInsightsLoadAttempted = true;
  if (!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) return null;
  try {
    const mod = await import('applicationinsights');
    const ai = mod.default || mod;
    if (!ai.defaultClient) {
      ai.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
        .setAutoCollectExceptions(true)
        .setAutoCollectRequests(false)
        .setAutoCollectDependencies(false)
        .setAutoCollectPerformance(false)
        .setSendLiveMetrics(false)
        .start();
    }
    appInsightsBridge = ai.defaultClient || null;
  } catch {
    // Package not installed — that's fine, structured stdout is still emitted.
    appInsightsBridge = null;
  }
  return appInsightsBridge;
}

// Trigger load attempt at startup so we know whether the bridge is wired.
void loadAppInsightsBridge();

function emitToStream(payload) {
  const stream = payload.level === 'error' ? process.stderr : process.stdout;
  try {
    stream.write(JSON.stringify(payload) + '\n');
  } catch {
    // Last-ditch: if even stdout write fails, swallow — never throw from logger.
  }
}

function emitToAppInsights(payload) {
  if (!appInsightsBridge) return;
  try {
    if (payload.level === 'error' && payload.error instanceof Error) {
      appInsightsBridge.trackException({ exception: payload.error, properties: payload });
    } else {
      appInsightsBridge.trackTrace({
        message: payload.event || 'event',
        severity: payload.level === 'error' ? 3 : payload.level === 'warn' ? 2 : 1,
        properties: payload,
      });
    }
  } catch {
    // AI errors must not break the request path.
  }
}

/**
 * Emit a single structured log event.
 * @param {{ level?: 'info'|'warn'|'error', event: string, [key:string]: unknown }} fields
 */
export function logEvent(fields) {
  const payload = {
    ts: new Date().toISOString(),
    level: fields.level || 'info',
    ...fields,
  };
  emitToStream(payload);
  emitToAppInsights(payload);
}

export function logInfo(event, fields = {}) {
  logEvent({ level: 'info', event, ...fields });
}

export function logWarn(event, fields = {}) {
  logEvent({ level: 'warn', event, ...fields });
}

export function logError(event, error, fields = {}) {
  logEvent({
    level: 'error',
    event,
    error: error?.message || String(error || ''),
    ...fields,
  });
}
