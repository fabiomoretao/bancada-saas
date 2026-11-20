import { WarningIcon } from '@phosphor-icons/react';
import type { CustomerMatchDTO } from '@bancada/shared';
import { useId } from 'react';
import styles from './DuplicateNotice.module.css';

const MATCH_LABEL = { phone: 'mesmo telefone', email: 'mesmo e-mail' } as const;

/**
 * Aviso de possível duplicidade. Telefone e e-mail podem ser compartilhados
 * (família, empresa), então o sistema só avisa: a oficina confere e decide.
 */
export function DuplicateNotice({
  matches,
  onUse,
  useLabel = 'Usar este cadastro',
  confirm,
}: {
  matches: CustomerMatchDTO[];
  /** Troca para o cadastro existente (na abertura da OS). */
  onUse?: (match: CustomerMatchDTO) => void;
  useLabel?: string;
  /** Mostrado depois que a API pediu confirmação: "é outra pessoa". */
  confirm?: { checked: boolean; onChange: (checked: boolean) => void };
}) {
  const confirmId = useId();
  if (matches.length === 0) return null;

  return (
    <div className={styles.notice} role="status" aria-live="polite">
      <div className={styles.head}>
        <WarningIcon size={20} aria-hidden="true" />
        <strong>
          {matches.length === 1
            ? 'Já existe um cadastro com este contato.'
            : `Já existem ${matches.length} cadastros com este contato.`}
        </strong>
      </div>
      <p className={styles.help}>Pode ser a mesma pessoa. Confira antes de continuar.</p>
      <ul className={styles.list}>
        {matches.map((match) => (
          <li key={match.id} className={styles.item}>
            <span className={styles.who}>
              <strong>{match.name}</strong>
              <small>
                {[match.phone, match.email].filter(Boolean).join(' · ')} — {match.matchedOn.map((m) => MATCH_LABEL[m]).join(' e ')}
              </small>
            </span>
            {onUse && (
              <button type="button" className="btn" onClick={() => onUse(match)}>
                {useLabel}
              </button>
            )}
          </li>
        ))}
      </ul>
      {confirm && (
        <label htmlFor={confirmId} className={styles.confirm}>
          <input id={confirmId} type="checkbox" checked={confirm.checked} onChange={(e) => confirm.onChange(e.target.checked)} />
          Conferi: é outra pessoa. Cadastrar mesmo assim.
        </label>
      )}
    </div>
  );
}
