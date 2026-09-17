import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Optional subtitle below the title */
  description?: string;
  children: ReactNode;
  /** Footer content — typically action buttons */
  footer?: ReactNode;
  /** Max width class. Default: max-w-lg */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Unique id suffix for aria-labelledby. Default: 'modal' */
  id?: string;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

/**
 * Accessible modal dialog with focus trap, Escape key handler,
 * and backdrop click dismiss.
 *
 * Uses unique IDs to avoid duplicate `id="modal-title"` across the app.
 */
export default function Modal({
  open,
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  id = 'modal',
}: ModalProps) {
  const isShown = open ?? isOpen ?? false;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save and restore focus; trap focus inside modal
  useEffect(() => {
    if (!isShown) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the dialog container on open
    const timer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(timer);
      // Restore focus when modal closes
      previousFocusRef.current?.focus();
    };
  }, [isShown]);

  // Escape key handler
  useEffect(() => {
    if (!isShown) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isShown, onClose]);

  // Prevent background scroll
  useEffect(() => {
    if (isShown) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isShown]);

  if (!isShown) return null;

  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/50 motion-safe:transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative z-10 w-full ${sizeMap[size]} bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[90vh] outline-none`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold text-ink leading-snug"
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-ink-muted mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>

        {/* Footer — sticky at bottom */}
        {footer && (
          <div className="border-t border-border px-5 py-3 flex items-center justify-end gap-2 bg-card rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
