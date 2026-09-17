import type { ElementType, ReactNode } from 'react';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
  /** Icon component from lucide-react. Default: PackageOpen */
  icon?: ReactNode | ElementType;
  /** Main heading */
  title: string;
  /** Supporting description */
  description?: string;
  /** Call-to-action button or content */
  action?: ReactNode;
}

/**
 * Consistent empty state for tables, lists, and grids.
 * One clear message + one clear action.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-ink-faint mb-4">
        {Icon ? (
          typeof Icon === 'function' ? <Icon size={24} /> : Icon
        ) : (
          <PackageOpen size={24} />
        )}
      </div>
      <h3 className="text-base font-semibold text-ink mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-ink-muted max-w-sm mb-4">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
