import { CheckIcon, ClipboardTextIcon, GuitarIcon, MagnifyingGlassIcon, UserIcon, UserPlusIcon } from '@phosphor-icons/react';
import {
  createWorkOrderSchema,
  INSTRUMENT_TYPES,
  type CreateWorkOrderInput,
  type CustomerMatchDTO,
} from '@bancada/shared';
import { useId, useState, type ReactNode } from 'react';
import { useForm, useWatch, type FieldPath } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useContactDuplicates, useCreateWorkOrder, useCustomer, useCustomers } from '../api/hooks';
import { DuplicateNotice } from '../components/DuplicateNotice';
import { StatusBadge } from '../components/StatusBadge';
import { instrumentTitle, relativeDay } from '../lib/format';
import { useDebounced } from '../lib/useDebounced';
import styles from './NewOrderPage.module.css';

interface FormValues {
  customer: { name: string; phone: string; email: string };
  instrument: { type: string; brand: string; model: string; serialNumber: string };
  intake: { problemReport: string; intakeCondition: string; accessories: string };
}

const EMPTY: FormValues = {
  customer: { name: '', phone: '', email: '' },
  instrument: { type: '', brand: '', model: '', serialNumber: '' },
  intake: { problemReport: '', intakeCondition: '', accessories: '' },
};

type CustomerMode = 'search' | 'existing' | 'new';

/**
 * Nova OS. O luthier busca o cliente por nome, telefone ou e-mail; se
 * encontrar, seleciona e confere contato e histórico; se não, cadastra na hora.
 * Contato repetido gera aviso de possível duplicidade, e a oficina decide.
 */
export function NewOrderPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const create = useCreateWorkOrder();
  const preselected = params.get('cliente');

  const [customerMode, setCustomerMode] = useState<CustomerMode>(preselected ? 'existing' : 'search');
  const [customerId, setCustomerId] = useState<string | null>(preselected);
  // '' = ainda não escolheu, 'new' = outro instrumento; vem pré-escolhido quando a OS nasce da tela de Instrumentos.
  const [instrumentChoice, setInstrumentChoice] = useState<string>(params.get('instrumento') ?? '');
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [serverMatches, setServerMatches] = useState<CustomerMatchDTO[]>([]);
  const [formError, setFormError] = useState('');
  const [contactError, setContactError] = useState('');
  const [pickerError, setPickerError] = useState('');
  const [instrumentError, setInstrumentError] = useState('');

  const selected = useCustomer(customerMode === 'existing' ? (customerId ?? undefined) : undefined);
  const customerInstruments = selected.data?.instruments ?? [];
  const effectiveInstrument = customerMode === 'existing' && customerInstruments.length > 0 ? instrumentChoice : 'new';

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: EMPTY, shouldFocusError: true });

  const [phone, email] = useWatch({ control, name: ['customer.phone', 'customer.email'] });
  const contact = useDebounced({ phone: phone ?? '', email: email ?? '' }, 400);
  const live = useContactDuplicates(customerMode === 'new' ? contact : {});
  const matches = customerMode !== 'new' ? [] : serverMatches.length ? serverMatches : (live.data?.items ?? []);

  function selectCustomer(id: string) {
    setCustomerId(id);
    setCustomerMode('existing');
    setInstrumentChoice('');
    setPickerError('');
    setServerMatches([]);
    setAllowDuplicate(false);
    setContactError('');
    clearErrors('customer');
  }

  function startNewCustomer(prefill: string) {
    const text = prefill.trim();
    setCustomerMode('new');
    setCustomerId(null);
    setPickerError('');
    if (text.includes('@')) setValue('customer.email', text);
    else if (/^[\d\s()+-]{8,}$/.test(text)) setValue('customer.phone', text);
    else if (text) setValue('customer.name', text);
  }

  function contactChanged() {
    setServerMatches([]);
    setAllowDuplicate(false);
    setContactError('');
  }

  function buildPayload(values: FormValues): CreateWorkOrderInput | null {
    if (customerMode === 'search' || (customerMode === 'existing' && !customerId)) {
      setPickerError('Selecione um cliente da busca ou cadastre um novo.');
      return null;
    }
    if (effectiveInstrument === '') {
      setInstrumentError('Escolha um dos instrumentos do cliente ou “Outro instrumento”.');
      return null;
    }
    return {
      customer:
        customerMode === 'existing'
          ? { mode: 'existing', id: customerId! }
          : { mode: 'new', ...values.customer, allowDuplicate },
      instrument: effectiveInstrument === 'new' ? { mode: 'new', ...values.instrument } : { mode: 'existing', id: effectiveInstrument },
      intake: values.intake,
    };
  }

  function applyFieldErrors(fields: Record<string, string>) {
    for (const [path, message] of Object.entries(fields)) {
      if (path === 'customer.contact') setContactError(message);
      else if (path === 'customer.id') setPickerError(message);
      else if (path === 'instrument.id') setInstrumentError(message);
      else setError(path as FieldPath<FormValues>, { message }, { shouldFocus: true });
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError('');
    setContactError('');
    setPickerError('');
    setInstrumentError('');
    const payload = buildPayload(values);
    if (!payload) return setFormError('Confira os campos destacados antes de salvar.');

    const parsed = createWorkOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join('.')] ??= issue.message;
      applyFieldErrors(fields);
      return setFormError('Confira os campos destacados antes de salvar.');
    }

    try {
      const result = await create.mutateAsync(payload);
      navigate(`/ordens/${result.workOrder.id}`, { state: { created: true } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'possible_duplicate') {
        setServerMatches(err.duplicates);
        setFormError('Há um cadastro com o mesmo contato. Use o cadastro existente ou confirme que é outra pessoa.');
        document.getElementById('secao-cliente')?.scrollIntoView({ behavior: 'smooth' });
      } else if (err instanceof ApiError && err.code === 'validation_error') {
        applyFieldErrors(err.fields);
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.');
      }
    }
  }

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

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className={`surface ${styles.card}`}>
          <Section
            id="secao-cliente"
            title="Cliente e contato"
            hint={
              customerMode === 'new'
                ? 'Novo cadastro: nome e pelo menos um contato (telefone ou e-mail).'
                : 'Busque o cliente pelo nome, telefone ou e-mail. Se não encontrar, cadastre na hora.'
            }
          >
            {customerMode === 'search' && (
              <CustomerPicker onSelect={selectCustomer} onCreateNew={startNewCustomer} error={pickerError} />
            )}

            {customerMode === 'existing' && customerId && (
              <SelectedCustomer id={customerId} onChange={() => setCustomerMode('search')} error={pickerError} />
            )}

            {customerMode === 'new' && (
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
                          {...register('customer.phone', { onChange: contactChanged })}
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
                          {...register('customer.email', { onChange: contactChanged })}
                          type="email"
                          autoComplete="email"
                          placeholder="cliente@email.com"
                          aria-invalid={props['aria-invalid'] || Boolean(contactError) || undefined}
                        />
                      )}
                    </Field>
                  </div>
                  <p id="contato-ajuda" className="field-help">
                    Preencha pelo menos um. Os dados do cliente ficam só com a oficina; não aparecem no link.
                  </p>
                  <p id="contato-erro" className="field-error" role={contactError ? 'alert' : undefined}>
                    {contactError}
                  </p>
                </fieldset>

                <div className={styles.full}>
                  <DuplicateNotice
                    matches={matches}
                    onUse={(m) => selectCustomer(m.id)}
                    confirm={{ checked: allowDuplicate, onChange: setAllowDuplicate }}
                  />
                </div>

                <div className={styles.full}>
                  <button type="button" className="btn btn-ghost" onClick={() => setCustomerMode('search')}>
                    <MagnifyingGlassIcon size={16} aria-hidden="true" /> Voltar para a busca
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section id="secao-instrumento" title="Instrumento" hint="Identifique o equipamento que ficará na oficina.">
            {customerMode === 'existing' && customerInstruments.length > 0 && (
              <fieldset className={styles.choices} aria-describedby={instrumentError ? 'instrumento-erro' : undefined}>
                <legend className="field-label">
                  Qual instrumento? <span aria-hidden="true">*</span>
                </legend>
                {customerInstruments.map((i) => (
                  <label key={i.id} className={styles.choice} data-checked={instrumentChoice === i.id || undefined}>
                    <input
                      type="radio"
                      name="instrumento"
                      value={i.id}
                      checked={instrumentChoice === i.id}
                      onChange={() => {
                        setInstrumentChoice(i.id);
                        setInstrumentError('');
                      }}
                    />
                    <span>
                      <strong>{instrumentTitle(i)}</strong>
                      <small>
                        {[i.brand, i.serialNumber && `Série ${i.serialNumber}`].filter(Boolean).join(' · ') || 'Sem marca'} ·{' '}
                        {i.orderCount} {i.orderCount === 1 ? 'ordem' : 'ordens'}
                      </small>
                    </span>
                  </label>
                ))}
                <label className={styles.choice} data-checked={instrumentChoice === 'new' || undefined}>
                  <input
                    type="radio"
                    name="instrumento"
                    value="new"
                    checked={instrumentChoice === 'new'}
                    onChange={() => {
                      setInstrumentChoice('new');
                      setInstrumentError('');
                    }}
                  />
                  <span>
                    <strong>Outro instrumento</strong>
                    <small>Cadastrar um instrumento novo para este cliente</small>
                  </span>
                </label>
                {instrumentError && (
                  <p id="instrumento-erro" className="field-error" role="alert">
                    {instrumentError}
                  </p>
                )}
              </fieldset>
            )}

            {effectiveInstrument === 'new' && (
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
            )}
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
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || create.isPending}>
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

/** Busca de cliente por nome, telefone ou e-mail, com opção de cadastrar na hora. */
function CustomerPicker({
  onSelect,
  onCreateNew,
  error,
}: {
  onSelect: (id: string) => void;
  onCreateNew: (prefill: string) => void;
  error?: string;
}) {
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), 250);
  const searching = query.length >= 2;
  const results = useCustomers(query, { enabled: searching });
  const inputId = useId();
  const items = searching ? (results.data?.items ?? []) : [];

  return (
    <div className={styles.picker}>
      <label htmlFor={inputId} className="field-label">
        Buscar cliente <span aria-hidden="true">*</span>
      </label>
      <div className={styles.searchBox}>
        <MagnifyingGlassIcon size={18} aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nome, telefone ou e-mail"
          autoComplete="off"
          aria-describedby={error ? `${inputId}-erro` : undefined}
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error && (
        <p id={`${inputId}-erro`} className="field-error" role="alert">
          {error}
        </p>
      )}

      {searching && (
        <div className={styles.results} aria-live="polite">
          {results.isPending ? (
            <p className="field-help">Buscando…</p>
          ) : items.length === 0 ? (
            <p className="field-help">Nenhum cliente encontrado para “{query}”.</p>
          ) : (
            <ul>
              {items.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <button type="button" className={styles.result} onClick={() => onSelect(c.id)}>
                    <span>
                      <strong>{c.name}</strong>
                      <small>{[c.phone, c.email].filter(Boolean).join(' · ')}</small>
                    </span>
                    <small>
                      {c.orderCount} {c.orderCount === 1 ? 'ordem' : 'ordens'}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button type="button" className="btn" onClick={() => onCreateNew(text)}>
        <UserPlusIcon size={18} aria-hidden="true" /> Cadastrar novo cliente
      </button>
    </div>
  );
}

/** Cliente selecionado: conferir contato e histórico antes de continuar. */
function SelectedCustomer({ id, onChange, error }: { id: string; onChange: () => void; error?: string }) {
  const { data, isPending, isError } = useCustomer(id);
  if (isPending) return <p className="field-help">Carregando cadastro…</p>;
  if (isError || !data)
    return (
      <div className={styles.picker}>
        <p className="field-error" role="alert">
          {error || 'Não foi possível carregar este cliente.'}
        </p>
        <button type="button" className="btn" onClick={onChange}>
          Buscar outro cliente
        </button>
      </div>
    );

  return (
    <div className={styles.selected}>
      <div className={styles.selectedHead}>
        <div>
          <span className="eyebrow">Cliente selecionado</span>
          <strong className={styles.selectedName}>{data.name}</strong>
          <span className={styles.selectedContact}>{[data.phone, data.email].filter(Boolean).join(' · ') || 'Sem contato'}</span>
        </div>
        <button type="button" className="btn" onClick={onChange}>
          Trocar cliente
        </button>
      </div>
      <p className="field-help">
        Confira se o contato está atualizado. Para corrigir, <Link to={`/clientes/${data.id}`}>abra o cadastro</Link>.
      </p>
      {data.orders.length > 0 ? (
        <div>
          <span className={styles.historyTitle}>Histórico ({data.orders.length})</span>
          <ul className={styles.history}>
            {data.orders.slice(0, 4).map((o) => (
              <li key={o.id}>
                <span>
                  {o.code} · {instrumentTitle(o.instrument)} · {relativeDay(o.createdAt)}
                </span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="field-help">Ainda não há ordens para este cliente.</p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
