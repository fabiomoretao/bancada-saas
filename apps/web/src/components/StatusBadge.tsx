import { STATUS_LABELS, type WorkOrderStatus } from '@bancada/shared';
import styles from './StatusBadge.module.css';

/** Status sempre com texto; a bolinha é só reforço visual (não depende de cor). */
export function StatusBadge({ status, label }: { status: WorkOrderStatus; label?: string }) {
  return (
    <span className={styles.badge} data-status={status}>
      <span className={styles.dot} aria-hidden="true" />
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
