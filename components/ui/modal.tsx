'use client';

import { useEffect, useRef } from 'react';
import { Button } from './button';
import { CloseIcon } from './icons';

/**
 * Modal dialog.
 *
 * Uses the native `<dialog>` element so focus trapping, Escape handling and
 * inertness of the background come from the platform rather than from a
 * hand-rolled focus manager.
 */
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-white p-0 backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4">
        <h2 id="modal-title" className="text-base font-semibold text-ink-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>
      <div className="p-4 text-sm text-ink-700">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">{footer}</div>}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  closeLabel,
  destructive,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={closeLabel}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
