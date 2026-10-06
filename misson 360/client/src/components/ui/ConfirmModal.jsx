import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';

/**
 * מודאל אישור RTL — שימוש עם useConfirm או ישירות (open + onConfirm / onCancel)
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <button
        type="button"
        aria-label="סגור"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] transition-opacity"
        onClick={onCancel}
      />
      <div
        className={clsx(
          'relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl',
          'border-slate-200/90 bg-white dark:border-slate-600 dark:bg-slate-900',
        )}
        onClick={e => e.stopPropagation()}
      >
        <div
          className={clsx(
            'flex items-start gap-4 px-5 pt-6 sm:px-6',
            variant === 'danger' &&
              'border-b border-red-100 bg-gradient-to-l from-red-50/90 to-white pb-5 dark:border-red-900/40 dark:from-red-950/35 dark:to-slate-900',
            variant !== 'danger' &&
              'border-b border-amber-100 bg-gradient-to-l from-amber-50/70 to-white pb-5 dark:border-amber-900/30 dark:from-amber-950/25 dark:to-slate-900',
          )}
        >
          <div
            className={clsx(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
              variant === 'danger'
                ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
            )}
          >
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-modal-title" className="text-[17px] font-bold text-slate-900 dark:text-slate-50">
              {title}
            </h2>
            {message ? (
              <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">{message}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 sm:px-6 sm:py-5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/90"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={clsx(
              'rounded-xl px-5 py-2.5 text-[14px] font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.99]',
              variant === 'danger' && 'bg-gradient-to-l from-red-600 to-red-700 shadow-red-900/20',
              variant !== 'danger' &&
                'bg-gradient-to-l from-[#a0660e] to-[#c47f17] shadow-amber-900/15',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

/**
 * הודעה מעוצבת — כפתור אחד (במקום alert)
 */
export function AlertModal({ open, title, message, buttonText = 'הבנתי', onClose, variant = 'default' }) {
  if (!open) return null;

  const node = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir="rtl" role="alertdialog" aria-modal="true">
      <button type="button" aria-label="סגור" className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900',
        )}
        onClick={e => e.stopPropagation()}
      >
        <div
          className={clsx(
            'border-b px-5 py-5 sm:px-6',
            variant === 'error'
              ? 'border-red-100 bg-gradient-to-l from-red-50/90 to-white dark:border-red-900/40 dark:from-red-950/30 dark:to-slate-900'
              : 'border-amber-100 bg-gradient-to-l from-amber-50/70 to-white dark:border-amber-900/30 dark:from-amber-950/25 dark:to-slate-900',
          )}
        >
          <h2 className="text-[17px] font-bold text-slate-900 dark:text-slate-50">{title}</h2>
          {message ? <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">{message}</p> : null}
        </div>
        <div className="flex justify-end px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gradient-to-l from-[#a0660e] to-[#c47f17] px-6 py-2.5 text-[14px] font-bold text-white shadow-md transition hover:brightness-105"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}
