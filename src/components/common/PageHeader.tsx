import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Page title — the only h1 on the screen */
  title: string;
  /** Brief description text */
  description?: string;
  subtitle?: string;
  /** Primary action button — positioned right on desktop */
  primaryAction?: ReactNode;
  actions?: ReactNode;
  /** Secondary actions — smaller buttons grouped after primary */
  secondaryActions?: ReactNode;
}

/**
 * Consistent page header across all screens.
 * Title left, primary action right, secondary actions grouped.
 */
export default function PageHeader({
  title,
  description,
  subtitle,
  primaryAction,
  actions,
  secondaryActions,
}: PageHeaderProps) {
  const desc = description || subtitle;
  const primary = primaryAction || actions;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-ink tracking-tight">{title}</h1>
        {desc && (
          <p className="text-sm text-ink-muted mt-0.5">{desc}</p>
        )}
      </div>
      {(primary || secondaryActions) && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {secondaryActions}
          {primary}
        </div>
      )}
    </div>
  );
}
