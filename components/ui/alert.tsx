import { cn } from '@/utils/cn';
import { CheckIcon, InfoIcon, WarningIcon } from './icons';

type Tone = 'info' | 'warning' | 'danger' | 'success' | 'neutral';

const TONES: Record<Tone, { wrapper: string; icon: string }> = {
  info: { wrapper: 'bg-info-50 border-info-100 text-ink-800', icon: 'text-info-500' },
  warning: { wrapper: 'bg-warn-50 border-warn-100 text-ink-800', icon: 'text-warn-500' },
  danger: { wrapper: 'bg-danger-50 border-danger-100 text-ink-800', icon: 'text-danger-500' },
  success: { wrapper: 'bg-brand-50 border-brand-100 text-ink-800', icon: 'text-brand-600' },
  neutral: { wrapper: 'bg-ink-50 border-ink-200 text-ink-800', icon: 'text-ink-500' },
};

/**
 * An alert always carries three signals: colour, an icon, and a text label.
 * Colour alone is never the message (§25).
 */
export function Alert({
  tone = 'info',
  title,
  label,
  children,
  className,
  role,
}: {
  tone?: Tone;
  title?: string;
  /** Short text label announcing the kind of alert, e.g. "Warning". */
  label?: string;
  children?: React.ReactNode;
  className?: string;
  role?: 'alert' | 'status' | 'note';
}) {
  const styles = TONES[tone];
  const Icon = tone === 'warning' || tone === 'danger' ? WarningIcon : tone === 'success' ? CheckIcon : InfoIcon;

  return (
    <div
      className={cn('flex gap-3 rounded-xl border p-3.5 sm:p-4', styles.wrapper, className)}
      role={role ?? (tone === 'danger' ? 'alert' : 'note')}
    >
      <Icon className={cn('size-5 shrink-0 mt-0.5', styles.icon)} />
      <div className="min-w-0 text-sm leading-relaxed">
        {label && (
          <span className="block text-2xs font-semibold uppercase tracking-wide text-ink-600">
            {label}
          </span>
        )}
        {title && <p className="font-semibold text-ink-900">{title}</p>}
        {children}
      </div>
    </div>
  );
}
