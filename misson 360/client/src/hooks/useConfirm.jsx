import { useState, useCallback, useRef } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal';

/**
 * מחזיר פונקציית confirm אסינכרונית ורכיב מודאל שיש לרנדר בתוך הקומפוננטה.
 * const ok = await confirm({ title, message, variant: 'danger' });
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    const {
      title = 'לאישור',
      message = '',
      confirmLabel = 'אישור',
      cancelLabel = 'ביטול',
      variant = 'danger',
    } = opts;

    return new Promise(resolve => {
      resolveRef.current = resolve;
      setConfig({ title, message, confirmLabel, cancelLabel, variant });
      setOpen(true);
    });
  }, []);

  const finish = useCallback(value => {
    setOpen(false);
    setConfig(null);
    const fn = resolveRef.current;
    resolveRef.current = null;
    fn?.(value);
  }, []);

  const dialog = open && config && (
    <ConfirmModal
      open={open}
      title={config.title}
      message={config.message}
      confirmLabel={config.confirmLabel}
      cancelLabel={config.cancelLabel}
      variant={config.variant}
      onCancel={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  );

  return { confirm, ConfirmDialog: dialog };
}
