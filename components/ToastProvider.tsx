import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconInfoCircle, IconAlertCircle, IconX } from '@tabler/icons-react';

export type ToastVariant = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  description?: string;
}

interface ToastContextValue {
  toast: (input: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  info: (message: string, description?: string) => string;
  success: (message: string, description?: string) => string;
  error: (message: string, description?: string) => string;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 6000;

function variantStyles(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return {
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/10',
        icon: <IconCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      };
    case 'error':
      return {
        border: 'border-destructive/30',
        bg: 'bg-destructive/10',
        icon: <IconAlertCircle className="w-4 h-4 text-destructive" />,
      };
    case 'info':
    default:
      return {
        border: 'border-border',
        bg: 'bg-card',
        icon: <IconInfoCircle className="w-4 h-4 text-muted-foreground" />,
      };
  }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback((input: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { ...input, id }]);
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    timersRef.current.set(id, timer);
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  const api = useMemo<ToastContextValue>(() => ({
    toast,
    dismiss,
    info: (message, description) => toast({ variant: 'info', message, description }),
    success: (message, description) => toast({ variant: 'success', message, description }),
    error: (message, description) => toast({ variant: 'error', message, description }),
  }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        {toasts.map((t) => {
          const styles = variantStyles(t.variant);
          return (
            <div
              key={t.id}
              role={t.variant === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-md border px-3 py-2.5 shadow-lg ${styles.border} ${styles.bg}`}
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="shrink-0 mt-0.5">{styles.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground">{t.message}</p>
                {t.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Dismiss notification"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback if provider missing
    return {
      toast: () => '',
      dismiss: () => {},
      info: () => '',
      success: () => '',
      error: () => '',
    };
  }
  return ctx;
}
