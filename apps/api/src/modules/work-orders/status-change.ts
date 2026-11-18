import { isTerminal, type ActorType, type EventVisibility, type WorkOrderStatus } from '@bancada/shared';
import type { Transaction, Updateable } from 'kysely';
import type { Database, WorkOrderRow, WorkOrderTable } from '../../db/schema';
import { conflict } from '../../lib/errors';
import { newId } from '../../lib/ids';

export interface StatusChange {
  order: Pick<WorkOrderRow, 'id' | 'status'>;
  to: WorkOrderStatus;
  actor: ActorType;
  eventType: string;
  message: string;
  visibility?: EventVisibility;
  now: string;
  /** Outros campos da OS que mudam junto com o status. */
  patch?: Updateable<WorkOrderTable>;
}

/**
 * Muda o status da OS e grava o evento correspondente, sempre na mesma transação.
 *
 * O UPDATE só acontece se o status no banco ainda for o que foi lido
 * (controle otimista). Se outra ação mudou a OS no meio do caminho, nada é
 * gravado e a API responde 409, em vez de sobrescrever o que aconteceu.
 */
export async function applyStatusChange(trx: Transaction<Database>, change: StatusChange): Promise<void> {
  const result = await trx
    .updateTable('workOrders')
    .set({
      ...change.patch,
      status: change.to,
      updatedAt: change.now,
      closedAt: isTerminal(change.to) ? change.now : null,
    })
    .where('id', '=', change.order.id)
    .where('status', '=', change.order.status)
    .executeTakeFirst();

  if (Number(result.numUpdatedRows) === 0) {
    throw conflict('status_changed', 'A ordem foi alterada por outra ação. Recarregue a página e tente de novo.');
  }

  await trx
    .insertInto('workOrderEvents')
    .values({
      id: newId(),
      workOrderId: change.order.id,
      actorType: change.actor,
      eventType: change.eventType,
      fromStatus: change.order.status,
      toStatus: change.to,
      message: change.message,
      visibility: change.visibility ?? 'customer',
      idempotencyKey: null,
      createdAt: change.now,
    })
    .execute();
}
