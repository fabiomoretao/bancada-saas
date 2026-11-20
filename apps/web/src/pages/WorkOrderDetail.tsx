import { ArrowsClockwiseIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { STATUS_LABELS, type WorkOrderDetailDTO } from '@bancada/shared';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAddNote, useRegeneratePublicLink, useWorkOrder } from '../api/hooks';
import { CopyLinkButton } from '../components/CopyLinkButton';
import { EstimateBox, versionLabel } from '../components/EstimateBox';
import { StateMessage } from '../components/StateMessage';
import { StatusBadge } from '../components/StatusBadge';
import { StatusTimeline } from '../components/StatusTimeline';
import { useToast } from '../components/Toast';
import { formatDateTime, instrumentSubtitle } from '../lib/format';
import { WorkflowPanel } from './WorkflowPanel';
import styles from './WorkOrderDetail.module.css';


interface CreatedState {
  created?: boolean;
}

export function WorkOrderDetail({ id }: { id: string }) {
  const { data: order, isPending, isError, error, refetch } = useWorkOrder(id);
  const location = useLocation();
  const justCreated = (location.state as CreatedState | null)?.created === true;

  if (isPending) return <StateMessage kind="loading" title="Carregando ordem…" />;
  if (isError) {
    return (
      <StateMessage
        kind="error"
        title="Não foi possível abrir esta ordem"
        action={
          <button className="btn" onClick={() => refetch()}>
            Tentar de novo
          </button>
        }
      >
        {error.message}
      </StateMessage>
    );
  }

  return <DetailContent order={order} justCreated={justCreated} />;
}

function DetailContent({ order, justCreated }: { order: WorkOrderDetailDTO; justCreated: boolean }) {
  const toast = useToast();
  const regenerate = useRegeneratePublicLink(order.id);
  const subtitle = instrumentSubtitle(order.instrument);
  const contact = [order.customer.phone, order.customer.email].filter(Boolean).join(' · ');

  async function handleRegenerate() {
    const ok = window.confirm('Gerar um link novo? O link enviado antes ao cliente deixará de funcionar.');
    if (!ok) return;
    await regenerate.mutateAsync();
    toast('Link novo gerado. Copie e envie ao cliente.');
  }

  return (
    <article className={styles.detail}>
      {justCreated && (
        <div className={styles.created} role="status">
          <CheckCircleIcon size={22} aria-hidden="true" />
          <div>
            <strong>{order.code} criada em “Recebido”.</strong>
            <p>Copie o link privado e envie ao cliente pelo canal que preferir. Nada é enviado automaticamente.</p>
          </div>
        </div>
      )}

      <div className={styles.top}>
        <span className={styles.code}>
          {order.code} · Entrada em {formatDateTime(order.createdAt)}
        </span>
        <StatusBadge status={order.status} />
      </div>

      <h2 className={styles.title}>{order.instrument.type}</h2>
      <p className={styles.subtitle}>
        {subtitle && `${subtitle} · `}Cliente {order.customer.name}
      </p>

      <dl className={styles.facts}>
        <div>
          <dt>Contato</dt>
          <dd>{contact}</dd>
        </div>
        <div>
          <dt>Nº de série</dt>
          <dd>{order.instrument.serialNumber ?? '—'}</dd>
        </div>
        {order.accessories && (
          <div>
            <dt>Acessórios</dt>
            <dd>{order.accessories}</dd>
          </div>
        )}
        {order.expectedReadyAt && !order.closedAt && (
          <div>
            <dt>Previsão</dt>
            <dd>{formatDateTime(order.expectedReadyAt)}</dd>
          </div>
        )}
      </dl>

      <WorkflowPanel order={order} />

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>Relato na entrada</h3>
        <p className={styles.note}>{order.problemReport}</p>
        {order.intakeCondition && (
          <p className={styles.noteMuted}>
            <strong>Condição ao receber:</strong> {order.intakeCondition}
          </p>
        )}
      </section>

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>Orçamento vigente</h3>
        {order.currentEstimate ? (
          <EstimateBox estimate={order.currentEstimate} />
        ) : (
          <p className={styles.noteMuted}>Ainda não há orçamento publicado para esta ordem.</p>
        )}
        {order.draftEstimate && (
          <p className={styles.history}>
            Rascunho {versionLabel(order.draftEstimate.versionNumber)} em edição — o cliente ainda não vê.
          </p>
        )}
        {order.estimateHistory.length > 1 && (
          <p className={styles.history}>
            {order.estimateHistory.length} versões no histórico. Versões anteriores ficam preservadas.
          </p>
        )}
      </section>

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>Linha do tempo</h3>
        <StatusTimeline status={order.status} events={order.events} />
      </section>


      <div className={styles.actions}>
        {order.publicPath ? (
          <CopyLinkButton path={order.publicPath} className="btn btn-primary" />
        ) : (
          <span className={styles.noteMuted}>Sem link ativo.</span>
        )}
        <button type="button" className="btn" onClick={handleRegenerate} disabled={regenerate.isPending}>
          <ArrowsClockwiseIcon size={18} aria-hidden="true" />
          Gerar link novo
        </button>
      </div>

      <details className={styles.events}>
        <summary>Histórico completo ({order.events.length})</summary>
        <NoteForm orderId={order.id} />
        <ol>
          {[...order.events].reverse().map((event) => (
            <li key={event.id}>
              <span className={styles.eventWhen}>
                {formatDateTime(event.createdAt)}
                {event.actorName && <small>{event.actorName}</small>}
              </span>
              <span>
                {event.toStatus && event.fromStatus !== event.toStatus ? <strong>{STATUS_LABELS[event.toStatus]}. </strong> : null}
                {event.message}
                {event.visibility === 'internal' && <span className={styles.internal}>Interna</span>}
                {event.actorType === 'customer' && <span className={styles.internal}>Cliente</span>}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}

/** Nota interna (só a oficina vê) ou atualização pública (aparece no link do cliente). */
function NoteForm({ orderId }: { orderId: string }) {
  const addNote = useAddNote(orderId);
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    try {
      await addNote.mutateAsync({ message: message.trim(), visibility: isPublic ? 'customer' : 'internal' });
      setMessage('');
      toast(isPublic ? 'Atualização publicada para o cliente' : 'Nota interna registrada');
    } catch {
      // mensagem exibida abaixo
    }
  }

  return (
    <form className={styles.noteForm} onSubmit={submit}>
      <label htmlFor={`nota-${orderId}`} className="visually-hidden">
        Nova nota ou atualização
      </label>
      <textarea
        id={`nota-${orderId}`}
        className="input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escreva uma nota ou atualização"
        maxLength={1000}
      />
      <div className={styles.noteActions}>
        <label className={styles.check}>
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Visível para o cliente
        </label>
        <button type="submit" className="btn" disabled={addNote.isPending || !message.trim()}>
          Registrar
        </button>
      </div>
      {addNote.error && (
        <p className="field-error" role="alert">
          {addNote.error.message}
        </p>
      )}
    </form>
  );
}
