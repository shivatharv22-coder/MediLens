'use client';

import { PASSWORD_RULES } from '@/config/app';
import { CheckIcon } from '@/components/ui/icons';
import { cn } from '@/utils/cn';

/**
 * Shared layout for the authentication screens.
 *
 * Narrow, centred, and comfortable on a 375px phone: a single column with
 * generous spacing and no card chrome below `sm`, so the form fills the screen
 * instead of floating in a box.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-sm">
      {/* A plain div, not <header>: the app already has one banner header, and
          a second <header> element here reads as a second page header. */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-600">{description}</p>}
      </div>

      <div className="sm:card sm:p-5">{children}</div>

      {footer && (
        <div className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-ink-600">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Live password requirement checklist.
 *
 * Requirements are always visible, not revealed only after a failure, and each
 * one reports its own state rather than the whole field being "invalid".
 */
export function PasswordRequirements({ value, id }: { value: string; id?: string }) {
  return (
    <ul id={id} className="mt-2 space-y-1" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.id} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className={cn(
                'grid size-4 shrink-0 place-items-center rounded-full border',
                met ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 text-transparent',
              )}
            >
              <CheckIcon className="size-3" />
            </span>
            <span className={met ? 'text-brand-700' : 'text-ink-500'}>
              {rule.label}
              {/* The icon is decorative, so state is also carried in text. */}
              <span className="sr-only">{met ? ' — met' : ' — not met yet'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
