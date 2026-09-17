import type { ElementType, ReactNode } from 'react';

interface StatusBadgeProps {
  /** The status variant determines color */
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | string;
  /** Text label — always shown alongside color for accessibility */
  label: string;
  /** Optional custom icon */
  icon?: ElementType | ReactNode;
  /** Optional small size */
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-primary-soft text-primary',
  neutral: 'bg-surface text-ink-muted',
};

/**
 * Status badge that always uses color + text label together.
 * Never color alone — per accessibility requirements.
 */
export default function StatusBadge({
  variant,
  status,
  label,
  icon: Icon,
  size = 'sm',
}: StatusBadgeProps) {
  const v = (variant || status || 'neutral') as 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  const style = variantStyles[v] || variantStyles.neutral;

  const sizeClasses =
    size === 'sm'
      ? 'text-xs px-2 py-0.5'
      : 'text-sm px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-md ${sizeClasses} ${style}`}
    >
      {Icon ? (
        typeof Icon === 'function' ? <Icon size={12} aria-hidden="true" /> : Icon
      ) : (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            v === 'success'
              ? 'bg-success'
              : v === 'warning'
              ? 'bg-warning'
              : v === 'danger'
              ? 'bg-danger'
              : v === 'info'
              ? 'bg-primary'
              : 'bg-ink-faint'
          }`}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
