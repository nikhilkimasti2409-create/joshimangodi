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
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
              isSuccess
                ? 'bg-[#F0FDF4]/95 border-emerald-300 text-emerald-950 shadow-emerald-900/10'
                : isError
                ? 'bg-[#FEF2F2]/95 border-red-300 text-red-950 shadow-red-900/10'
                : isWarning
                ? 'bg-[#FFFBEB]/95 border-amber-300 text-amber-950 shadow-amber-900/10'
                : 'bg-white/95 border-[#FCE7F3] text-[#31102A] shadow-purple-900/10'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 size={18} className="text-emerald-600" />}
              {isError && <XCircle size={18} className="text-red-600" />}
              {isWarning && <AlertTriangle size={18} className="text-amber-600" />}
              {toast.type === 'info' && <Info size={18} className="text-[#9F1239]" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-black leading-snug">{toast.title}</div>
              {toast.message && (
                <div className="text-[11px] opacity-85 mt-0.5 leading-relaxed font-medium">
                  {toast.message}
                </div>
              )}
            </div>

            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 p-1 text-gray-400 hover:text-black rounded-lg hover:bg-black/5 transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
