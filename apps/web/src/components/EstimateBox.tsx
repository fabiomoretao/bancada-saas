import { formatCents, type EstimateDTO } from '@bancada/shared';
import styles from './EstimateBox.module.css';

const ESTIMATE_STATUS_LABEL: Record<EstimateDTO['status'], string> = {
  draft: 'Rascunho',
  published: 'Aguardando decisão',
  approved: 'Aprovado',
  revision_requested: 'Revisão solicitada',
  rejected: 'Recusado',
  superseded: 'Substituído',
};

export const versionLabel = (n: number) => `V. ${String(n).padStart(2, '0')}`;

export function EstimateBox({ estimate, showDiagnosis = true }: { estimate: EstimateDTO; showDiagnosis?: boolean }) {
  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <span>{versionLabel(estimate.versionNumber)}</span>
        <span className={styles.state}>{ESTIMATE_STATUS_LABEL[estimate.status]}</span>
      </div>

      {showDiagnosis && (
        <p className={styles.diagnosis}>
          <strong>Diagnóstico: </strong>
          {estimate.diagnosis}
        </p>
      )}

      <ul className={styles.items}>
        {estimate.items.map((item) => (
          <li key={item.id} className={styles.line}>
            <span>
              {item.description}
              <span className={styles.kind}>
                {item.type === 'part' ? 'Peça' : 'Serviço'}
                {item.quantity > 1 ? ` · ${item.quantity} × ${formatCents(item.unitPriceCents)}` : ''}
              </span>
            </span>
            <strong>{formatCents(item.lineTotalCents)}</strong>
          </li>
        ))}
      </ul>

      <div className={styles.total}>
        <span>Total estimado</span>
        <strong>{formatCents(estimate.totalCents)}</strong>
      </div>

      {estimate.estimatedBusinessDays !== null && (
        <p className={styles.foot}>
          Prazo previsto: {estimate.estimatedBusinessDays} {estimate.estimatedBusinessDays === 1 ? 'dia útil' : 'dias úteis'} após
          aprovação{estimate.needsParts ? ', depois da chegada da peça' : ''}.
        </p>
      )}
      {estimate.decisionMessage && (
        <p className={styles.message}>
          <strong>Mensagem do cliente: </strong>“{estimate.decisionMessage}”
        </p>
      )}
    </div>
  );
}
