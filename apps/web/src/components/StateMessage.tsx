import { WarningCircleIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import styles from './StateMessage.module.css';

/** Mensagens de carregando, vazio e erro com o mesmo visual em todas as telas. */
export function StateMessage({
  kind = 'empty',
  title,
  children,
  action,
}: {
  kind?: 'loading' | 'empty' | 'error';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.state} data-kind={kind} role={kind === 'error' ? 'alert' : 'status'} aria-busy={kind === 'loading'}>
      {kind === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
      {kind === 'error' && <WarningCircleIcon size={22} aria-hidden="true" />}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
