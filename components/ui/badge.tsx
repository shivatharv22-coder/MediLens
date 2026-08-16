import { cn } from '@/utils/cn';
import type { ConfidenceLevel } from '@/types/identification';
import { CheckIcon, InfoIcon, WarningIcon } from './icons';

type Tone = 'neutral' | 'brand' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
  brand: 'bg-brand-50 text-brand-800 border-brand-200',
  warning: 'bg-warn-50 text-warn-700 border-warn-100',
  danger: 'bg-danger-50 text-danger-700 border-danger-100',
  info: 'bg-info-50 text-info-500 border-info-100',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const CONFIDENCE_TONE: Record<ConfidenceLevel, Tone> = {
  HIGH: 'brand',
  MEDIUM: 'warning',
  LOW: 'warning',
  NOT_IDENTIFIED: 'danger',
};

/**
 * Identification confidence.
 *
 * Always renders the level as words as well as colour, and never says
 * "identified" for anything below HIGH.
 */
export function ConfidenceBadge({
  level,
  label,
  a11yLabel,
}: {
  level: ConfidenceLevel;
  label: string;
  a11yLabel: string;
}) {
  const Icon = level === 'HIGH' ? CheckIcon : level === 'NOT_IDENTIFIED' ? InfoIcon : WarningIcon;
  return (
    <Badge tone={CONFIDENCE_TONE[level]}>
      <Icon className="size-3.5" />
      <span className="sr-only">{a11yLabel}: </span>
      {label}
    </Badge>
  );
}
