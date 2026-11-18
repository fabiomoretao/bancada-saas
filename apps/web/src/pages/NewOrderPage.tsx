import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, ClipboardTextIcon, GuitarIcon, UserIcon } from '@phosphor-icons/react';
import {
  createWorkOrderSchema,
  INSTRUMENT_TYPES,
  type CreateWorkOrderData,
  type CreateWorkOrderInput,
} from '@bancada/shared';
import { useId, useState, type ReactNode } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useCreateWorkOrder } from '../api/hooks';
import styles from './NewOrderPage.module.css';

const EMPTY: CreateWorkOrderInput = {
  customer: { name: '', phone: '', email: '' },
  instrument: { type: '', brand: '', model: '', serialNumber: '' },
  intake: { problemReport: '', intakeCondition: '', accessories: '' },
};

/** Nova OS: página própria com os blocos Cliente e contato, Instrumento e Entrada. */
export function NewOrderPage() {
  const navigate = useNavigate();
  const create = useCreateWorkOrder();
  const [formError, setFormError] = useState('');
  const [serverContactError, setServerContactError] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkOrderInput, unknown, CreateWorkOrderData>({
    resolver: zodResolver(createWorkOrderSchema),
    defaultValues: EMPTY,
    shouldFocusError: true,
  });

  const contactError =
    (errors.customer as Record<string, { message?: string }> | undefined)?.contact?.message ?? serverContactError;

  async function onSubmit(data: CreateWorkOrderData) {
    setFormError('');
    setServerContactError('');
    try {
      const result = await create.mutateAsync(data);
      navigate(`/ordens/${result.workOrder.id}`, { state: { created: true } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_error') {
        for (const [path, message] of Object.entries(err.fields)) {
          if (path === 'customer.contact') setServerContactError(message);
          else setError(path as FieldPath<CreateWorkOrderInput>, { message });
        }
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.');
      }
    }
  }

  const invalidSubmit = () => setFormError('Confira os campos destacados antes de salvar.');

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Nova ordem de serviço</h1>
        <p className={styles.subtitle}>
          Registre os dados essenciais. A ordem começa em <strong>Recebido</strong>; o diagnóstico vem depois.
        </p>
      </div>

      <nav className={styles.stepper} aria-label="Seções do formulário">
        <a href="#secao-cliente">
          <UserIcon size={16} aria-hidden="true" /> Cliente e contato
        </a>
        <a href="#secao-instrumento">
          <GuitarIcon size={16} aria-hidden="true" /> Instrumento
        </a>
        <a href="#secao-entrada">
          <ClipboardTextIcon size={16} aria-hidden="true" /> Entrada
        </a>
      </nav>

      <form onSubmit={handleSubmit(onSubmit, invalidSubmit)} noValidate>
        <div className={`surface ${styles.card}`}>
          <Section id="secao-cliente" title="Cliente e contato" hint="Telefone ou e-mail: pelo menos um dos dois é necessário.">
            <div className={styles.grid}>
              <Field label="Nome completo" required error={errors.customer?.name?.message} full>
                {(props) => <input {...props} {...register('customer.name')} autoComplete="name" placeholder="Ex.: Alex Ribeiro" />}
              </Field>

              <fieldset
                className={`${styles.contact} ${styles.full}`}
                aria-describedby="contato-ajuda contato-erro"
                aria-invalid={contactError ? true : undefined}
              >
                <legend className="field-label">
                  Como falar com o cliente <span aria-hidden="true">*</span>
                </legend>
                <div className={styles.pair}>
                  <Field label="Telefone ou WhatsApp" error={errors.customer?.phone?.message} optional>
                    {(props) => (
                      <input
                        {...props}
                        {...register('customer.phone')}
                        type="tel"
                        autoComplete="tel"
                        placeholder="(11) 98888-1234"
                        aria-invalid={props['aria-invalid'] || Boolean(contactError) || undefined}
                      />
                    )}
                  </Field>
                  <Field label="E-mail" error={errors.customer?.email?.message} optional>
                    {(props) => (
                      <input
                        {...props}
                        {...register('customer.email')}
                        type="email"
                        autoComplete="email"
                        placeholder="cliente@email.com"
                        aria-invalid={props['aria-invalid'] || Boolean(contactError) || undefined}
                      />
                    )}
                  </Field>
                </div>
                <p id="contato-ajuda" className="field-help">
                  Preencha pelo menos um. O contato não aparece no link do cliente.
                </p>
                <p id="contato-erro" className="field-error" role={contactError ? 'alert' : undefined}>
                  {contactError}
                </p>
              </fieldset>
            </div>
          </Section>

          <Section id="secao-instrumento" title="Instrumento" hint="Identifique o equipamento que ficará na oficina.">
            <div className={styles.grid}>
              <Field label="Tipo" required error={errors.instrument?.type?.message}>
                {(props) => (
                  <select {...props} {...register('instrument.type')}>
                    <option value="">Selecione</option>
                    {INSTRUMENT_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Marca" optional error={errors.instrument?.brand?.message}>
                {(props) => <input {...props} {...register('instrument.brand')} placeholder="Ex.: Aurora" />}
              </Field>
              <Field label="Modelo" optional error={errors.instrument?.model?.message}>
                {(props) => <input {...props} {...register('instrument.model')} placeholder="Ex.: JB" />}
              </Field>
              <Field label="Número de série" optional error={errors.instrument?.serialNumber?.message}>
                {(props) => <input {...props} {...register('instrument.serialNumber')} placeholder="Se disponível" />}
              </Field>
            </div>
          </Section>

          <Section id="secao-entrada" title="Entrada" hint="O que o cliente relatou e como o instrumento chegou.">
            <div className={styles.grid}>
              <Field label="O que precisa de atenção?" required error={errors.intake?.problemReport?.message} full>
                {(props) => (
                  <textarea {...props} {...register('intake.problemReport')} placeholder="Descreva o problema relatado pelo cliente" />
                )}
              </Field>
              <Field label="Condição ao receber" optional error={errors.intake?.intakeCondition?.message} full>
                {(props) => (
                  <textarea {...props} {...register('intake.intakeCondition')} placeholder="Marcas, avarias ou estado geral observado" />
                )}
              </Field>
              <Field label="Acessórios recebidos" optional error={errors.intake?.accessories?.message} full>
                {(props) => <input {...props} {...register('intake.accessories')} placeholder="Ex.: case, alavanca, cabo" />}
              </Field>
            </div>
          </Section>
        </div>

        <div className={styles.footer}>
          <p className={styles.formError} role="alert">
            {formError}
          </p>
          <div className={styles.footerActions}>
            <Link to="/ordens" className="btn">
              Cancelar
            </Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <CheckIcon size={18} aria-hidden="true" />
              {isSubmitting ? 'Salvando…' : 'Salvar e gerar OS'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Section({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className={styles.sectionTitle}>
        {title}
      </h2>
      <p className={styles.sectionHint}>{hint}</p>
      {children}
    </section>
  );
}

interface ControlProps {
  id: string;
  className: string;
  'aria-invalid': boolean | undefined;
  'aria-describedby': string | undefined;
  'aria-required': boolean | undefined;
}

/** Rótulo visível + controle + erro associado por aria-describedby. */
function Field({
  label,
  required,
  optional,
  error,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  full?: boolean;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-erro`;
  return (
    <div className={`field ${full ? styles.full : ''}`}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {optional && <span className="field-optional">opcional</span>}
      </label>
      {children({
        id,
        className: 'input',
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
        'aria-required': required || undefined,
      })}
      {error && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
