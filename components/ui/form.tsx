'use client';

import { useId } from 'react';
import { cn } from '@/utils/cn';

const FIELD =
  'w-full min-h-12 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-base ' +
  'text-ink-900 placeholder:text-ink-400 disabled:bg-ink-50 disabled:text-ink-500';

/**
 * Every field is label-bound, and an error is wired through `aria-describedby`
 * plus `aria-invalid` so a screen reader announces it with the field.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
    required: boolean | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-800">
        {label}
        {required && (
          <span className="text-danger-500" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}
      {error && (
        <p id={errorId} className="text-sm text-danger-700 font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...rest} />;
}

export function TextArea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, 'min-h-24 resize-y', className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD, 'pr-9', className)} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink-900">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors',
          checked ? 'bg-brand-600 border-brand-600' : 'bg-ink-200 border-ink-300',
          disabled && 'opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
