import { zodResolver } from '@hookform/resolvers/zod';
import { customerSchema, type CustomerInput, type CustomerMatchDTO } from '@bancada/shared';
import { useId, useState } from 'react';
import { useForm, useWatch, type FieldPath } from 'react-hook-form';
import { ApiError } from '../api/client';
import { useContactDuplicates, useSaveCustomer } from '../api/hooks';
import { useDebounced } from '../lib/useDebounced';
import { DuplicateNotice } from './DuplicateNotice';
import styles from './CustomerForm.module.css';

/** Cadastro e edição de cliente, com aviso de possível duplicidade pelo contato. */
export function CustomerForm({
  customerId,
  initial,
  submitLabel,
  onSaved,
  onCancel,
  onOpenExisting,
}: {
  customerId?: string;
  initial?: { name: string; phone: string | null; email: string | null };
  submitLabel: string;
  onSaved: (id: string) => void;
  onCancel?: () => void;
  onOpenExisting?: (match: CustomerMatchDTO) => void;
}) {
  const save = useSaveCustomer(customerId);
  const [confirmed, setConfirmed] = useState(false);
  const [serverMatches, setServerMatches] = useState<CustomerMatchDTO[]>([]);
  const [formError, setFormError] = useState('');
  const ids = { name: useId(), phone: useId(), email: useId(), contact: useId() };

  const { register, handleSubmit, control, setError, formState } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: initial?.name ?? '', phone: initial?.phone ?? '', email: initial?.email ?? '', allowDuplicate: false },
  });
  const [phone, email] = useWatch({ control, name: ['phone', 'email'] });
  const contact = useDebounced({ phone: phone ?? '', email: email ?? '' }, 400);
  const live = useContactDuplicates({ ...contact, excludeId: customerId });
  const matches = serverMatches.length ? serverMatches : (live.data?.items ?? []);
  // Contato mudou: a confirmação anterior não vale para o novo contato.
  const contactChanged = () => {
    setServerMatches([]);
    setConfirmed(false);
  };
  const errors = formState.errors as Record<string, { message?: string } | undefined>;

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      const saved = await save.mutateAsync({ ...values, allowDuplicate: confirmed });
      onSaved(saved.id);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'possible_duplicate') {
        setServerMatches(err.duplicates);
        setFormError('Marque a confirmação abaixo se for outra pessoa, ou abra o cadastro existente.');
      } else if (err instanceof ApiError && err.code === 'validation_error') {
        for (const [path, message] of Object.entries(err.fields)) setError(path as FieldPath<CustomerInput>, { message });
      } else {
        setFormError(err instanceof Error ? err.message : 'Não foi possível salvar.');
      }
    }
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor={ids.name} className="field-label">
          Nome completo <span aria-hidden="true">*</span>
        </label>
        <input
          id={ids.name}
          className="input"
          autoComplete="name"
          {...register('name')}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${ids.name}-e` : undefined}
        />
        {errors.name && (
          <span id={`${ids.name}-e`} className="field-error">
            {errors.name.message}
          </span>
        )}
      </div>

      <fieldset className={styles.contact} aria-describedby={ids.contact}>
        <legend className="field-label">
          Contato <span aria-hidden="true">*</span>
        </legend>
        <div className={styles.pair}>
          <div className="field">
            <label htmlFor={ids.phone} className="field-label">
              Telefone ou WhatsApp<span className="field-optional">opcional</span>
            </label>
            <input
              id={ids.phone}
              className="input"
              type="tel"
              autoComplete="tel"
              placeholder="(11) 98888-1234"
              {...register('phone', { onChange: contactChanged })}
              aria-invalid={errors.phone || errors.contact ? true : undefined}
            />
            {errors.phone && <span className="field-error">{errors.phone.message}</span>}
          </div>
          <div className="field">
            <label htmlFor={ids.email} className="field-label">
              E-mail<span className="field-optional">opcional</span>
            </label>
            <input
              id={ids.email}
              className="input"
              type="email"
              autoComplete="email"
              placeholder="cliente@email.com"
              {...register('email', { onChange: contactChanged })}
              aria-invalid={errors.email || errors.contact ? true : undefined}
            />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </div>
        </div>
        <p id={ids.contact} className={errors.contact ? 'field-error' : 'field-help'}>
          {errors.contact?.message ?? 'Preencha pelo menos um. Telefone e e-mail podem se repetir entre cadastros.'}
        </p>
      </fieldset>

      <DuplicateNotice
        matches={matches}
        onUse={onOpenExisting}
        useLabel="Abrir cadastro"
        confirm={{ checked: confirmed, onChange: setConfirmed }}
      />

      {formError && (
        <p className="field-error" role="alert">
          {formError}
        </p>
      )}

      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
