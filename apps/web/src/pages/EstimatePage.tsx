import { ArrowLeftIcon, PaperPlaneTiltIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import {
  canPublishEstimate,
  formatCents,
  saveEstimateDraftSchema,
  STATUS_LABELS,
  toCents,
  type EstimateDTO,
  type SaveEstimateDraftInput,
  type WorkOrderDetailDTO,
} from '@bancada/shared';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useDiscardDraft, usePublishEstimate, useSaveDraft, useWorkOrder } from '../api/hooks';
import { Dialog } from '../components/Dialog';
import { versionLabel } from '../components/EstimateBox';
import { StateMessage } from '../components/StateMessage';
import { useToast } from '../components/Toast';
import { instrumentTitle } from '../lib/format';
import styles from './EstimatePage.module.css';

interface FormItem {
  type: 'service' | 'part';
  description: string;
  quantity: string;
  price: string;
}
interface FormValues {
  diagnosis: string;
  needsParts: boolean;
  days: string;
  items: FormItem[];
}

const EMPTY_ITEM: FormItem = { type: 'service', description: '', quantity: '1', price: '' };
const DAY_OPTIONS = [1, 2, 3, 4, 5, 7, 10, 15, 20, 30];

const centsToField = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

function initialValues(source: EstimateDTO | null): FormValues {
  if (!source) return { diagnosis: '', needsParts: false, days: '3', items: [{ ...EMPTY_ITEM }] };
  return {
    diagnosis: source.diagnosis,
    needsParts: source.needsParts,
    days: source.estimatedBusinessDays ? String(source.estimatedBusinessDays) : '',
    items: source.items.map((item) => ({
      type: item.type,
      description: item.description,
      quantity: String(item.quantity),
      price: centsToField(item.unitPriceCents),
    })),
  };
}

/** Converte o formulário (textos) no formato da API (números e centavos) e valida com o mesmo esquema do servidor. */
function toInput(values: FormValues): { data?: SaveEstimateDraftInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const items = values.items.map((item, index) => {
    const cents = toCents(item.price);
    if (cents === null) errors[`items.${index}.price`] = 'Informe um preço válido, ex.: 42,50.';
    return {
      type: item.type,
      description: item.description,
      quantity: Number(item.quantity.replace(',', '.')),
      unitPriceCents: cents ?? 0,
    };
  });
  const data: SaveEstimateDraftInput = {
    diagnosis: values.diagnosis,
    needsParts: values.needsParts,
    estimatedBusinessDays: values.days ? Number(values.days) : undefined,
    items,
  };

  const parsed = saveEstimateDraftSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.').replace(/unitPriceCents$/, 'price');
      errors[path || 'items'] ??= issue.message;
    }
  }
  return Object.keys(errors).length ? { errors } : { data, errors };
}

export function EstimatePage() {
  const { id = '' } = useParams();
  const { data: order, isPending, isError, error } = useWorkOrder(id);

  if (isPending) return <StateMessage kind="loading" title="Carregando ordem…" />;
  if (isError) return <StateMessage kind="error" title="Não foi possível abrir esta ordem">{error.message}</StateMessage>;

  if (!canPublishEstimate(order.status)) {
    return (
      <div className={styles.page}>
        <BackLink id={order.id} />
        <div className="surface">
          <StateMessage title="Orçamento indisponível agora">
            {order.status === 'received'
              ? 'Inicie a avaliação na fila antes de preparar o orçamento.'
              : order.status === 'awaiting_approval'
                ? 'O orçamento atual está aguardando a decisão do cliente.'
                : `A ordem está em “${STATUS_LABELS[order.status]}”.`}
          </StateMessage>
        </div>
      </div>
    );
  }

  // `key` recria o formulário se o rascunho mudar no servidor.
  return <EstimateForm key={order.draftEstimate?.id ?? 'novo'} order={order} />;
}

function BackLink({ id }: { id: string }) {
  return (
    <Link to={`/ordens/${id}`} className={`btn btn-ghost ${styles.back}`}>
      <ArrowLeftIcon size={18} aria-hidden="true" /> Voltar à ordem
    </Link>
  );
}

function EstimateForm({ order }: { order: WorkOrderDetailDTO }) {
  const navigate = useNavigate();
  const toast = useToast();
  const saveDraft = useSaveDraft(order.id);
  const publish = usePublishEstimate(order.id);
  const discard = useDiscardDraft(order.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const source = order.draftEstimate ?? order.currentEstimate;
  const versionNumber = order.draftEstimate?.versionNumber ?? (order.estimateHistory.at(-1)?.versionNumber ?? 0) + 1;
  const scopeChange = order.status === 'in_repair' || order.status === 'awaiting_parts';

  const { register, control, handleSubmit, setError, clearErrors, formState } = useForm<FormValues>({
    defaultValues: initialValues(source),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watched = useWatch({ control, name: 'items' });
  const total = (watched ?? []).reduce((sum, item) => {
    const cents = toCents(item?.price ?? '') ?? 0;
    const qty = Number(String(item?.quantity ?? '0').replace(',', '.')) || 0;
    return sum + Math.round(qty * cents);
  }, 0);
  const errors = formState.errors;

  function validate(values: FormValues): SaveEstimateDraftInput | null {
    clearErrors();
    setFormError('');
    const { data, errors: found } = toInput(values);
    if (!data) {
      for (const [path, message] of Object.entries(found)) {
        if (path === 'items') setFormError(message);
        else setError(path as FieldPath<FormValues>, { message });
      }
      setFormError((current) => current || 'Confira os campos destacados.');
      return null;
    }
    return data;
  }

  async function save(data: SaveEstimateDraftInput) {
    try {
      return await saveDraft.mutateAsync(data);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
      return null;
    }
  }

  const onSaveDraft = handleSubmit(async (values) => {
    const data = validate(values);
    if (data && (await save(data))) toast(`Rascunho ${versionLabel(versionNumber)} salvo`);
  });

  const onAskPublish = handleSubmit((values) => {
    if (validate(values)) setConfirmOpen(true);
  });

  const onPublish = handleSubmit(async (values) => {
    const data = validate(values);
    if (!data) return setConfirmOpen(false);
    const saved = await save(data);
    if (!saved?.draftEstimate) return setConfirmOpen(false);
    try {
      await publish.mutateAsync(saved.draftEstimate.versionNumber);
      toast(`Orçamento ${versionLabel(saved.draftEstimate.versionNumber)} publicado. Copie o link e envie ao cliente.`);
      navigate(`/ordens/${order.id}`);
    } catch (err) {
      setConfirmOpen(false);
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível publicar.');
    }
  });

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  async function onDiscard() {
    try {
      await discard.mutateAsync(undefined);
      setConfirmingDiscard(false);
      toast('Rascunho descartado');
      navigate(`/ordens/${order.id}`);
    } catch {
      // a mensagem aparece no diálogo
    }
  }

  const busy = saveDraft.isPending || publish.isPending;

  return (
    <div className={styles.page}>
      <BackLink id={order.id} />
      <div className={styles.head}>
        <div>
          <div className="eyebrow">
            {order.code} · {instrumentTitle(order.instrument)} · {order.customer.name}
          </div>
          <h1 className={styles.title}>Diagnóstico e orçamento</h1>
          <p className={styles.subtitle}>
            {versionLabel(versionNumber)} · rascunho. O cliente só vê depois de publicado; depois disso a versão não muda.
          </p>
        </div>
      </div>

      {order.status === 'revision_requested' && order.currentEstimate?.decisionMessage && (
        <p className={styles.notice}>
          <strong>O cliente pediu revisão da {versionLabel(order.currentEstimate.versionNumber)}:</strong> “
          {order.currentEstimate.decisionMessage}”
        </p>
      )}
      {scopeChange && (
        <p className={styles.notice}>
          <strong>Mudança de escopo.</strong> Ao publicar, a ordem volta para “Aguardando aprovação” e o trabalho alterado só continua
          depois que o cliente aprovar a nova versão.
        </p>
      )}

      <form className={styles.layout} onSubmit={(e) => e.preventDefault()} noValidate>
        <section className={`surface ${styles.card}`} aria-labelledby="diag-titulo">
          <h2 id="diag-titulo" className={styles.cardTitle}>
            Diagnóstico técnico
          </h2>
          <p className={styles.cardHint}>Este texto aparece para o cliente junto com o orçamento.</p>
          <div className="field">
            <label htmlFor="diagnosis" className="field-label">
              O que foi identificado? <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="diagnosis"
              className="input"
              {...register('diagnosis')}
              aria-invalid={errors.diagnosis ? true : undefined}
              aria-describedby={errors.diagnosis ? 'diagnosis-erro' : undefined}
              placeholder="Ex.: jack com contato instável; controles precisam de limpeza e ressolda."
            />
            {errors.diagnosis && (
              <span id="diagnosis-erro" className="field-error">
                {errors.diagnosis.message}
              </span>
            )}
          </div>

          <h2 className={`${styles.cardTitle} ${styles.itemsTitle}`}>Itens</h2>
          <div className={styles.itemHead} aria-hidden="true">
            <span>Tipo</span>
            <span>Descrição</span>
            <span>Qtd.</span>
            <span>Preço unit. (R$)</span>
            <span />
          </div>
          <ul className={styles.items}>
            {fields.map((field, index) => {
              const itemErrors = errors.items?.[index];
              const message = itemErrors?.description?.message ?? itemErrors?.quantity?.message ?? itemErrors?.price?.message;
              return (
                <li key={field.id} className={styles.itemRow}>
                  <select className="input" aria-label={`Tipo do item ${index + 1}`} {...register(`items.${index}.type`)}>
                    <option value="service">Serviço</option>
                    <option value="part">Peça</option>
                  </select>
                  <input
                    className="input"
                    aria-label={`Descrição do item ${index + 1}`}
                    placeholder="Descrição do serviço ou peça"
                    aria-invalid={itemErrors?.description ? true : undefined}
                    {...register(`items.${index}.description`)}
                  />
                  <input
                    className="input"
                    inputMode="numeric"
                    placeholder="Qtd."
                    aria-label={`Quantidade do item ${index + 1}`}
                    aria-invalid={itemErrors?.quantity ? true : undefined}
                    {...register(`items.${index}.quantity`)}
                  />
                  <input
                    className="input"
                    inputMode="decimal"
                    aria-label={`Preço unitário do item ${index + 1}`}
                    placeholder="Preço (R$)"
                    aria-invalid={itemErrors?.price ? true : undefined}
                    {...register(`items.${index}.price`)}
                  />
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label={`Remover item ${index + 1}`}
                  >
                    <TrashIcon size={18} aria-hidden="true" />
                  </button>
                  {message && <span className={`field-error ${styles.itemError}`}>{message}</span>}
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn" onClick={() => append({ ...EMPTY_ITEM })}>
            <PlusIcon size={18} aria-hidden="true" /> Adicionar item
          </button>
        </section>

        <aside className={styles.side}>
          <section className={`surface ${styles.card}`} aria-labelledby="prazo-titulo">
            <h2 id="prazo-titulo" className={styles.cardTitle}>
              Prazo e peças
            </h2>
            <div className="field">
              <label htmlFor="days" className="field-label">
                Prazo após aprovação
              </label>
              <select id="days" className="input" {...register('days')}>
                <option value="">Sem prazo definido</option>
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? 'dia útil' : 'dias úteis'}
                  </option>
                ))}
              </select>
            </div>
            <label className={styles.check}>
              <input type="checkbox" {...register('needsParts')} />
              Há peça pendente de chegada
            </label>
            <p className={styles.cardHint}>Com peça pendente, a aprovação leva a ordem para “Aguardando peça”.</p>
          </section>

          <section className={`surface ${styles.card}`} aria-labelledby="total-titulo">
            <h2 id="total-titulo" className={styles.cardTitle}>
              Total estimado
            </h2>
            <p className={styles.total} aria-live="polite">
              {formatCents(total)}
            </p>
            <p className={styles.cardHint}>O valor final é recalculado pelo servidor a partir dos itens.</p>

            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}

            <div className={styles.actions}>
              <button type="button" className="btn btn-primary" onClick={onAskPublish} disabled={busy}>
                <PaperPlaneTiltIcon size={18} aria-hidden="true" /> Publicar para o cliente
              </button>
              <button type="button" className="btn" onClick={onSaveDraft} disabled={busy}>
                Salvar rascunho
              </button>
              {order.draftEstimate && (
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmingDiscard(true)} disabled={busy || discard.isPending}>
                  Descartar rascunho
                </button>
              )}
            </div>
          </section>
        </aside>
      </form>

      <Dialog
        open={confirmOpen}
        title={`Publicar ${versionLabel(versionNumber)}?`}
        confirmLabel="Publicar"
        busy={busy}
        onConfirm={() => onPublish()}
        onClose={() => setConfirmOpen(false)}
      >
        <p>
          Total de <strong>{formatCents(total)}</strong>. O cliente poderá aprovar, pedir revisão ou recusar pelo link privado.
        </p>
        <p>Depois de publicada, esta versão não pode ser editada; mudanças geram uma nova versão.</p>
      </Dialog>

      <Dialog
        open={confirmingDiscard}
        title="Descartar o rascunho?"
        confirmLabel="Descartar"
        tone="danger"
        busy={discard.isPending}
        error={discard.error?.message}
        onConfirm={onDiscard}
        onClose={() => setConfirmingDiscard(false)}
      >
        <p>As alterações não publicadas serão perdidas. O que o cliente já viu continua igual.</p>
      </Dialog>
    </div>
  );
}
