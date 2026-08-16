import { cn } from '@/utils/cn';
import { Alert } from './alert';

/** Loading spinner with an accessible live-region label. */
export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-ink-600', className)}>
      <span
        className="size-4 rounded-full border-2 border-ink-300 border-t-brand-600 animate-spin"
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}

/** A full-width loading block that announces itself to assistive tech. */
export function LoadingState({ message, regionLabel }: { message: string; regionLabel: string }) {
  return (
    <div
      className="card flex flex-col items-center gap-3 p-8 text-center"
      role="status"
      aria-live="polite"
      aria-label={regionLabel}
    >
      <span
        className="size-8 rounded-full border-2 border-ink-200 border-t-brand-600 animate-spin"
        aria-hidden
      />
      <p className="text-sm text-ink-600">{message}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon && <div className="text-ink-400">{icon}</div>}
      <p className="text-base font-semibold text-ink-900">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-600">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <Alert tone="danger" title={title} role="alert">
      <p>{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </Alert>
  );
}

export function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('skeleton h-4', i === count - 1 && 'w-2/3')} />
      ))}
    </div>
  );
}
