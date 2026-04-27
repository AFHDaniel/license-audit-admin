import React from 'react';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error', error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-destructive/10 p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-start gap-3">
            <IconAlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-lg text-foreground">Something went wrong</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                This screen crashed while rendering. The rest of the app should still work.
              </p>
              <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-secondary/50 border border-border px-3 py-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                {error.message}
              </pre>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.reset}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <IconRefresh className="w-3.5 h-3.5" />
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
