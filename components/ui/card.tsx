import { cn } from '@/utils/cn';

export function Card({
  className,
  children,
  as: Tag = 'div',
}: {
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return <Tag className={cn('card p-4 sm:p-5', className)}>{children}</Tag>;
}

export function CardHeading({
  children,
  id,
  className,
  level = 2,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  level?: 2 | 3;
}) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <Tag id={id} className={cn('text-base font-semibold text-ink-900 mb-2', className)}>
      {children}
    </Tag>
  );
}

/** Label / value row used throughout the medicine page. */
export function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 border-b border-[var(--border)] last:border-b-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-sm font-medium text-ink-900 text-right">{value}</dd>
    </div>
  );
}
