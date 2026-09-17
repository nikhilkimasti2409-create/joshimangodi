import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

let toastListeners: Array<(toasts: ToastMessage[]) => void> = [];
let activeToasts: ToastMessage[] = [];

function emitToasts() {
  toastListeners.forEach((l) => l([...activeToasts]));
}

export function showToast(title: string, message?: string, type: ToastType = 'info', duration: number = 3200) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newToast: ToastMessage = { id, title, message, type, duration };

  // Keep max 3 active toasts
  activeToasts = [newToast, ...activeToasts.slice(0, 2)];
  emitToasts();

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }
}

export function dismissToast(id: string) {
  activeToasts = activeToasts.filter((t) => t.id !== id);
  emitToasts();
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>(activeToasts);

  useEffect(() => {
    const listener = (newToasts: ToastMessage[]) => setToasts(newToasts);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg shadow-lg border bg-card motion-safe:transition-all motion-safe:duration-300 transform translate-y-0 ${
              isSuccess
                ? 'border-success/30'
                : isError
                ? 'border-danger/30'
                : isWarning
                ? 'border-warning/30'
                : 'border-primary/30'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 size={18} className="text-success" />}
              {isError && <XCircle size={18} className="text-danger" />}
              {isWarning && <AlertTriangle size={18} className="text-warning" />}
              {toast.type === 'info' && <Info size={18} className="text-primary" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink leading-snug">{toast.title}</div>
              {toast.message && (
                <div className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                  {toast.message}
                </div>
              )}
            </div>

            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 p-1 text-ink-muted hover:text-ink rounded-lg hover:bg-surface transition cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
