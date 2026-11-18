import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './Dialog.module.css';

export interface DialogField {
  label: string;
  placeholder?: string;
  required?: boolean;
  requiredMessage?: string;
}

/**
 * Diálogo de confirmação acessível (elemento <dialog> nativo: foco preso,
 * Esc fecha). Opcionalmente pede um texto, como a mensagem de revisão.
 */
export function Dialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Voltar',
  tone = 'default',
  field,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  field?: DialogField;
  busy?: boolean;
  error?: string;
  onConfirm: (text: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState('');
  const titleId = useId();
  const fieldId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setText('');
      setFieldError('');
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (field?.required && !text.trim()) {
      setFieldError(field.requiredMessage ?? 'Preencha este campo.');
      return;
    }
    onConfirm(text.trim());
  }

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children && <div className={styles.body}>{children}</div>}

        {field && (
          <div className="field">
            <label htmlFor={fieldId} className="field-label">
              {field.label}
              {!field.required && <span className="field-optional">opcional</span>}
            </label>
            <textarea
              id={fieldId}
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={field.placeholder}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${fieldId}-erro` : undefined}
              maxLength={1000}
            />
            {fieldError && (
              <span id={`${fieldId}-erro`} className="field-error">
                {fieldError}
              </span>
            )}
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="submit" className={`btn ${tone === 'danger' ? styles.danger : 'btn-primary'}`} disabled={busy}>
            {busy ? 'Enviando…' : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
