import {
  BellRingingIcon,
  ChatCircleTextIcon,
  HandshakeIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PackageIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import type { WorkOrderDetailDTO, WorkOrderStatus, WorkshopAction } from '@bancada/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTransition } from '../api/hooks';
import { Dialog } from '../components/Dialog';
import { versionLabel } from '../components/EstimateBox';
import { useToast } from '../components/Toast';
import styles from './WorkflowPanel.module.css';

const GUIDANCE: Record<WorkOrderStatus, string> = {
  received: 'O instrumento chegou. Comece a avaliação para registrar o diagnóstico.',
  evaluating: 'Registre o diagnóstico e os itens do orçamento. O cliente só vê depois de publicado.',
  awaiting_approval: 'O orçamento está com o cliente. O reparo só começa depois da aprovação.',
  revision_requested: 'O cliente pediu uma revisão. Prepare uma nova versão do orçamento.',
  awaiting_parts: 'Orçamento aprovado. Registre a chegada da peça para começar o reparo.',
  in_repair: 'Reparo em andamento. Ao terminar, marque como pronto para retirada.',
  ready_for_pickup: 'Pronto para retirada. Registre a entrega quando o cliente buscar o instrumento.',
  delivered: 'Ordem encerrada. O histórico continua disponível.',
  declined: 'O cliente recusou o serviço. A ordem foi encerrada e o histórico preservado.',
};

const SUCCESS: Record<WorkshopAction, string> = {
  start_evaluation: 'Avaliação iniciada',
  register_part_arrival: 'Chegada da peça registrada. Reparo iniciado',
  complete_repair: 'Reparo concluído. Pronto para retirada',
  deliver: 'Entrega registrada. Ordem encerrada',
};

/** Próximo passo da OS: mostra só as ações válidas para o status atual. */
export function WorkflowPanel({ order }: { order: WorkOrderDetailDTO }) {
  const toast = useToast();
  const transition = useTransition(order.id);
  const [dialog, setDialog] = useState<WorkshopAction | null>(null);

  async function run(action: WorkshopAction, message?: string) {
    try {
      await transition.mutateAsync({ action, message: message || undefined, visibility: 'customer' });
      setDialog(null);
      toast(SUCCESS[action]);
    } catch {
      // o erro aparece no painel/diálogo via transition.error
    }
  }

  const estimatePath = `/ordens/${order.id}/orcamento`;
  const hasDraft = Boolean(order.draftEstimate);
  const nextVersion = order.draftEstimate?.versionNumber ?? (order.estimateHistory.at(-1)?.versionNumber ?? 0) + 1;
  const revisionMessage = order.status === 'revision_requested' ? order.currentEstimate?.decisionMessage : null;
  const error = transition.error?.message;

  return (
    <section className={styles.panel} aria-labelledby="proximo-passo">
      <h3 id="proximo-passo" className={styles.title}>
        Próximo passo
      </h3>
      <p className={styles.guidance}>{GUIDANCE[order.status]}</p>

      {revisionMessage && (
        <blockquote className={styles.quote}>
          <ChatCircleTextIcon size={18} aria-hidden="true" />
          <span>
            <strong>Mensagem do cliente:</strong> “{revisionMessage}”
          </span>
        </blockquote>
      )}

      <div className={styles.actions}>
        {order.status === 'received' && (
          <button className="btn btn-primary" onClick={() => run('start_evaluation')} disabled={transition.isPending}>
            <MagnifyingGlassIcon size={18} aria-hidden="true" /> Iniciar avaliação
          </button>
        )}

        {(order.status === 'evaluating' || order.status === 'revision_requested') && (
          <Link to={estimatePath} className="btn btn-primary">
            <NotePencilIcon size={18} aria-hidden="true" />
            {hasDraft
              ? `Continuar rascunho ${versionLabel(nextVersion)}`
              : order.status === 'revision_requested'
                ? `Preparar ${versionLabel(nextVersion)}`
                : 'Preparar orçamento'}
          </Link>
        )}

        {order.status === 'awaiting_parts' && (
          <button className="btn btn-primary" onClick={() => setDialog('register_part_arrival')} disabled={transition.isPending}>
            <PackageIcon size={18} aria-hidden="true" /> Registrar chegada da peça
          </button>
        )}

        {order.status === 'in_repair' && (
          <button className="btn btn-primary" onClick={() => setDialog('complete_repair')} disabled={transition.isPending}>
            <WrenchIcon size={18} aria-hidden="true" /> Concluir reparo
          </button>
        )}

        {order.status === 'ready_for_pickup' && (
          <button className="btn btn-primary" onClick={() => setDialog('deliver')} disabled={transition.isPending}>
            <HandshakeIcon size={18} aria-hidden="true" /> Registrar entrega
          </button>
        )}

        {(order.status === 'awaiting_parts' || order.status === 'in_repair') && (
          <Link to={estimatePath} className="btn">
            <NotePencilIcon size={18} aria-hidden="true" />
            {hasDraft ? `Continuar ${versionLabel(nextVersion)}` : 'Alterar escopo (nova versão)'}
          </Link>
        )}
      </div>

      {error && !dialog && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Dialog
        open={dialog === 'register_part_arrival'}
        title="Registrar chegada da peça?"
        confirmLabel="Registrar e iniciar reparo"
        busy={transition.isPending}
        error={dialog ? error : undefined}
        onConfirm={() => run('register_part_arrival')}
        onClose={() => setDialog(null)}
      >
        <p>A ordem passa para “Em reparo” e o cliente vê a atualização no link.</p>
      </Dialog>

      <Dialog
        open={dialog === 'complete_repair'}
        title="Concluir o reparo?"
        confirmLabel="Marcar como pronto"
        busy={transition.isPending}
        error={dialog ? error : undefined}
        field={{ label: 'Orientação de retirada para o cliente', placeholder: 'Ex.: retirada de terça a sábado, das 10h às 18h' }}
        onConfirm={(text) => run('complete_repair', text)}
        onClose={() => setDialog(null)}
      >
        <p>
          <BellRingingIcon size={16} aria-hidden="true" /> A ordem passa para “Pronto para retirada”. Avise o cliente pelo canal de
          sempre; nada é enviado automaticamente.
        </p>
      </Dialog>

      <Dialog
        open={dialog === 'deliver'}
        title="Registrar a entrega?"
        confirmLabel="Registrar entrega"
        busy={transition.isPending}
        error={dialog ? error : undefined}
        onConfirm={() => run('deliver')}
        onClose={() => setDialog(null)}
      >
        <p>A ordem será encerrada como “Entregue”. O histórico continua disponível.</p>
      </Dialog>
    </section>
  );
}
