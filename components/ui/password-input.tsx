'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { EyeIcon, EyeOffIcon } from './icons';

/**
 * Password field with a show/hide toggle.
 *
 * The toggle is a real `<button>` inside the field, labelled and
 * `aria-pressed`, so it is reachable by keyboard and announced correctly. It
 * never changes the value — only the input's `type`.
 */
export function PasswordInput({
  className,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  showLabel?: string;
  hideLabel?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={cn(
          'w-full min-h-12 rounded-xl border border-[var(--border)] bg-white py-2.5 pl-3.5 pr-12',
          'text-base text-ink-900 placeholder:text-ink-400 disabled:bg-ink-50 disabled:text-ink-500',
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? hideLabel : showLabel}
        // Sits inside the field but keeps a 44px touch area.
        className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-ink-500 hover:text-ink-800"
      >
        {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
      </button>
    </div>
  );
}
