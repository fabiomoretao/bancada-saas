import type { WorkOrderEventDTO, WorkOrderStatus } from '@bancada/shared';
import { formatDateTime } from '../lib/format';
import styles from './StatusTimeline.module.css';

/** Etapas resumidas exibidas na linha do tempo. */
const STEPS = [
  { key: 'received', label: 'Recebido', statuses: ['received'] },
  { key: 'evaluation', label: 'Avaliação', statuses: ['evaluating'] },
  { key: 'approval', label: 'Aprovação', statuses: ['awaiting_approval', 'revision_requested'] },
  { key: 'repair', label: 'Reparo', statuses: ['awaiting_parts', 'in_repair', 'ready_for_pickup'] },
  { key: 'delivery', label: 'Entrega', statuses: ['delivered'] },
] as const satisfies ReadonlyArray<{ key: string; label: string; statuses: readonly WorkOrderStatus[] }>;

export function StatusTimeline({ status, events }: { status: WorkOrderStatus; events: WorkOrderEventDTO[] }) {
  if (status === 'declined') {
    return <p className={styles.closed}>Ordem encerrada: o cliente recusou o serviço. O histórico continua disponível.</p>;
  }

  const currentIndex = STEPS.findIndex((step) => (step.statuses as readonly WorkOrderStatus[]).includes(status));

  const reachedAt = (index: number): string | null => {
    const statuses = STEPS[index]!.statuses as readonly WorkOrderStatus[];
    const event = events.find((e) => e.toStatus && statuses.includes(e.toStatus));
    return event ? formatDateTime(event.createdAt) : null;
  };

  return (
    <ol className={styles.timeline}>
      {STEPS.map((step, index) => {
        const state = index < currentIndex || status === 'delivered' ? 'done' : index === currentIndex ? 'current' : 'todo';
        const when = state === 'todo' ? null : reachedAt(index);
        return (
          <li key={step.key} className={styles.step} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className={styles.label}>{step.label}</span>
            <span className={styles.when}>{state === 'current' && !when ? 'Agora' : (when ?? '')}</span>
            <span className="visually-hidden">
              {state === 'done' ? '(concluída)' : state === 'current' ? '(etapa atual)' : '(pendente)'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
