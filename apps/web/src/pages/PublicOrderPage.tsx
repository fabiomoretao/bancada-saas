import { CheckIcon, ChatCircleTextIcon } from '@phosphor-icons/react';
import { formatCents, STATUS_LABELS, type CustomerDecision, type PublicWorkOrderDTO, type WorkOrderStatus } from '@bancada/shared';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useCustomerDecision, usePublicOrder } from '../api/hooks';
import { Dialog } from '../components/Dialog';
import logo from '../assets/logo-bancada.svg';
import { EstimateBox, versionLabel } from '../components/EstimateBox';
import { PublicOrderSkeleton } from '../components/Loading';
import BlurText from '../components/reactbits/BlurText';
import { StateMessage } from '../components/StateMessage';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatDateTime, instrumentSubtitle } from '../lib/format';
import styles from './PublicOrderPage.module.css';

/** Como o status aparece para o cliente (segunda pessoa, linguagem simples). */
const CUSTOMER_HEADLINE: Record<WorkOrderStatus, string> = {
  received: 'A oficina recebeu seu instrumento.',
  evaluating: 'Seu instrumento está em avaliação.',
  awaiting_approval: 'O orçamento está esperando sua decisão.',
  revision_requested: 'A oficina vai revisar a proposta.',
  awaiting_parts: 'A oficina está aguardando uma peça.',
  in_repair: 'O reparo está em andamento.',
  ready_for_pickup: 'Seu instrumento está pronto para retirada.',
  delivered: 'Instrumento entregue. Obrigado!',
  declined: 'Esta ordem foi encerrada.',
};

const CUSTOMER_STATUS_LABEL: Partial<Record<WorkOrderStatus, string>> = {
  awaiting_approval: 'Aguardando sua aprovação',
  declined: 'Serviço recusado',
};

/** Página pública do link privado. Fica fora do shell da oficina e não exige conta. */
export function PublicOrderPage() {
  const { token = '' } = useParams();
  const { data, isPending, isError, error } = usePublicOrder(token);

  return (
    <div className={styles.page}>
      <header className={styles.brand}>
        <img src={logo} alt="" className={styles.logo} />
        <strong>{data?.workshopName ?? 'Bancada'}</strong>
        <span className={styles.tag}>Acompanhamento privado</span>
      </header>

      {isPending ? (
        <PublicOrderSkeleton />
      ) : isError ? (
        <StateMessage kind="error" title="Link indisponível">
          {error.message} Se precisar, peça um link novo à oficina.
        </StateMessage>
      ) : (
        <PublicOrder order={data} token={token} />
      )}
    </div>
  );
}

function PublicOrder({ order, token }: { order: PublicWorkOrderDTO; token: string }) {
  const subtitle = instrumentSubtitle(order.instrument);

  return (
    <div className={styles.layout}>
      <section>
        <div className="eyebrow">Ordem de serviço · {order.code}</div>
        {/* O título surge palavra a palavra (React Bits BlurText) e repete quando o status muda. */}
        <BlurText
          key={order.status}
          as="h1"
          className={styles.headline}
          text={CUSTOMER_HEADLINE[order.status]}
          trigger="load"
          delay={70}
          stepDuration={0.3}
          blur={6}
          distance={14}
        />

        <div className={styles.meta}>
          <div>
            <strong>{order.instrument.type}</strong>
            <small>
              {subtitle && `${subtitle} · `}recebido em {formatDate(order.createdAt)}
            </small>
          </div>
          <StatusBadge status={order.status} label={CUSTOMER_STATUS_LABEL[order.status] ?? STATUS_LABELS[order.status]} />
        </div>

        <h2 className={styles.sectionTitle}>Atualizações</h2>
        <ol className={styles.timeline}>
          {[...order.timeline].reverse().map((event, index) => (
            <li key={event.id} data-current={index === 0 || undefined}>
              <strong>{event.toStatus ? STATUS_LABELS[event.toStatus] : 'Atualização da oficina'}</strong>
              <small>
                {formatDateTime(event.createdAt)}
                {event.message ? ` · ${event.message}` : ''}
              </small>
            </li>
          ))}
        </ol>
        <p className={styles.private}>Este link mostra somente esta ordem. Evite compartilhá-lo com outras pessoas.</p>
      </section>

      <aside className={`surface ${styles.card}`}>
        {order.currentEstimate ? (
          <>
            <div className="eyebrow">Proposta da oficina</div>
            <h2 className={styles.cardTitle}>Orçamento</h2>
            <EstimateBox estimate={order.currentEstimate} />
            <DecisionPanel order={order} token={token} />
            <p className={styles.foot}>Se o orçamento mudar, uma nova versão será apresentada para sua aprovação.</p>
          </>
        ) : (
          <StateMessage title="Ainda sem orçamento">A oficina vai avaliar o instrumento e publicar uma proposta aqui.</StateMessage>
        )}
      </aside>
    </div>
  );
}

const CONFIRMATION: Partial<Record<WorkOrderStatus, string>> = {
  in_repair: 'Aprovação registrada. A oficina já pode começar o reparo.',
  awaiting_parts: 'Aprovação registrada. A oficina vai começar assim que a peça chegar.',
  revision_requested: 'Pedido de revisão enviado. Você verá a nova versão aqui quando a oficina publicar.',
  declined: 'Recusa registrada. A ordem foi encerrada e o histórico continua disponível.',
};

/** Aprovar, pedir revisão ou recusar a versão vigente. Só aparece quando a decisão é possível. */
function DecisionPanel({ order, token }: { order: PublicWorkOrderDTO; token: string }) {
  const decision = useCustomerDecision(token);
  const [dialog, setDialog] = useState<CustomerDecision | null>(null);
  const [done, setDone] = useState(false);
  const estimate = order.currentEstimate;

  if (done && CONFIRMATION[order.status]) {
    return (
      <p className={styles.result} role="status">
        <CheckIcon size={18} aria-hidden="true" /> {CONFIRMATION[order.status]}
      </p>
    );
  }
  if (!order.canDecide || !estimate) return null;

  async function send(kind: CustomerDecision, message?: string) {
    try {
      await decision.mutateAsync({ decision: kind, versionNumber: estimate!.versionNumber, message: message || undefined });
      setDialog(null);
      setDone(true);
    } catch {
      // mensagem exibida no diálogo
    }
  }

  const error =
    decision.error instanceof ApiError && decision.error.code === 'estimate_not_current'
      ? `${decision.error.message}`
      : decision.error?.message;
  const label = versionLabel(estimate.versionNumber);

  return (
    <div className={styles.decision}>
      <button className="btn btn-primary" onClick={() => setDialog('approve')}>
        <CheckIcon size={18} aria-hidden="true" /> Aprovar orçamento
      </button>
      <button className="btn" onClick={() => setDialog('request_revision')}>
        <ChatCircleTextIcon size={18} aria-hidden="true" /> Pedir revisão
      </button>
      <button className={`btn btn-ghost ${styles.decline}`} onClick={() => setDialog('decline')}>
        Recusar o serviço
      </button>

      <Dialog
        open={dialog === 'approve'}
        title={`Aprovar ${label}?`}
        confirmLabel="Aprovar"
        busy={decision.isPending}
        error={dialog === 'approve' ? error : undefined}
        onConfirm={() => send('approve')}
        onClose={() => setDialog(null)}
      >
        <p>
          Você autoriza o serviço no valor estimado de <strong>{formatCents(estimate.totalCents)}</strong>.
        </p>
        <p>Se o orçamento mudar, uma nova versão será apresentada para sua aprovação.</p>
      </Dialog>

      <Dialog
        open={dialog === 'request_revision'}
        title="Pedir revisão"
        confirmLabel="Enviar pedido"
        busy={decision.isPending}
        error={dialog === 'request_revision' ? error : undefined}
        field={{
          label: 'O que você gostaria de ajustar?',
          placeholder: 'Ex.: dá para fazer só a regulagem, sem trocar as cordas?',
          required: true,
          requiredMessage: 'Conte à oficina o que gostaria de ajustar.',
        }}
        onConfirm={(text) => send('request_revision', text)}
        onClose={() => setDialog(null)}
      >
        <p>A oficina verá sua mensagem e poderá publicar uma nova versão.</p>
      </Dialog>

      <Dialog
        open={dialog === 'decline'}
        title="Recusar o serviço?"
        confirmLabel="Confirmar recusa"
        tone="danger"
        busy={decision.isPending}
        error={dialog === 'decline' ? error : undefined}
        field={{ label: 'Motivo', placeholder: 'Se quiser, conte o motivo à oficina' }}
        onConfirm={(text) => send('decline', text)}
        onClose={() => setDialog(null)}
      >
        <p>A ordem será encerrada. Combine a retirada do instrumento com a oficina.</p>
      </Dialog>
    </div>
  );
}
