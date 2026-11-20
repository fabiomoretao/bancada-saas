import {
  canPublishEstimate,
  lineTotalCents,
  nextStatus,
  STATUS_LABELS,
  totalCents,
  type saveEstimateDraftSchema,
} from '@bancada/shared';
import type { z } from 'zod';
import type { DB } from '../../db/client';
import { AppError, conflict, notFound } from '../../lib/errors';
import { newId, nowIso } from '../../lib/ids';
import * as repo from '../work-orders/work-orders.repository';
import { applyStatusChange } from '../work-orders/status-change';

type DraftData = z.output<typeof saveEstimateDraftSchema>;

export const versionLabel = (n: number) => `V. ${String(n).padStart(2, '0')}`;

/**
 * Orçamento versionado.
 * - Só existe um rascunho por vez; ele pode ser editado à vontade.
 * - Publicar transforma o rascunho em versão imutável e põe a OS em
 *   "Aguardando aprovação". Qualquer mudança posterior exige uma versão nova.
 */
export function createEstimatesService({ db }: { db: DB }) {
  async function loadOrder(workshopId: string, orderId: string) {
    const order = await repo.findOrder(db, workshopId, orderId);
    if (!order) throw notFound('Ordem de serviço não encontrada.');
    return order;
  }

  async function saveDraft(workshopId: string, orderId: string, data: DraftData): Promise<{ versionNumber: number }> {
    const order = await loadOrder(workshopId, orderId);
    if (!canPublishEstimate(order.status)) {
      throw conflict(
        'estimate_not_editable',
        `Não é possível preparar orçamento com a ordem em "${STATUS_LABELS[order.status]}".` +
          (order.status === 'received' ? ' Inicie a avaliação primeiro.' : ''),
      );
    }

    const items = data.items.map((item, position) => ({
      ...item,
      position,
      lineTotalCents: lineTotalCents(item),
    }));
    const total = totalCents(items);
    const now = nowIso();

    return db.transaction().execute(async (trx) => {
      const versions = await trx
        .selectFrom('estimateVersions')
        .select(['id', 'versionNumber', 'status'])
        .where('workOrderId', '=', order.id)
        .execute();
      const draft = versions.find((v) => v.status === 'draft');

      let estimateId: string;
      let versionNumber: number;
      if (draft) {
        estimateId = draft.id;
        versionNumber = draft.versionNumber;
        await trx
          .updateTable('estimateVersions')
          .set({
            diagnosis: data.diagnosis,
            needsParts: data.needsParts ? 1 : 0,
            estimatedBusinessDays: data.estimatedBusinessDays ?? null,
            totalCents: total,
          })
          .where('id', '=', draft.id)
          .where('status', '=', 'draft')
          .execute();
        await trx.deleteFrom('estimateItems').where('estimateVersionId', '=', draft.id).execute();
      } else {
        estimateId = newId();
        versionNumber = Math.max(0, ...versions.map((v) => v.versionNumber)) + 1;
        await trx
          .insertInto('estimateVersions')
          .values({
            id: estimateId,
            workOrderId: order.id,
            versionNumber,
            diagnosis: data.diagnosis,
            status: 'draft',
            currency: 'BRL',
            needsParts: data.needsParts ? 1 : 0,
            estimatedBusinessDays: data.estimatedBusinessDays ?? null,
            totalCents: total,
            createdAt: now,
            publishedAt: null,
            decisionAt: null,
            decisionMessage: null,
          })
          .execute();
      }

      await trx
        .insertInto('estimateItems')
        .values(items.map((item) => ({ id: newId(), estimateVersionId: estimateId, ...item })))
        .execute();

      return { versionNumber };
    });
  }

  async function publish(workshopId: string, orderId: string, versionNumber: number, userId?: string): Promise<void> {
    const order = await loadOrder(workshopId, orderId);

    await db.transaction().execute(async (trx) => {
      const version = await trx
        .selectFrom('estimateVersions')
        .selectAll()
        .where('workOrderId', '=', order.id)
        .where('versionNumber', '=', versionNumber)
        .executeTakeFirst();
      if (!version) throw notFound(`O orçamento ${versionLabel(versionNumber)} não existe.`);

      // Repetir a publicação da mesma versão não cria evento novo.
      if (version.status === 'published' && order.status === 'awaiting_approval') return;
      if (version.status !== 'draft') {
        throw conflict('estimate_already_published', `${versionLabel(versionNumber)} já foi publicada e não pode mudar. Crie uma nova versão.`);
      }

      const result = nextStatus(order.status, 'publish_estimate');
      if (!result.ok) throw new AppError(409, 'invalid_transition', result.reason);

      const now = nowIso();
      // Versões que esperavam decisão deixam de valer; aprovadas/recusadas ficam no histórico como estão.
      await trx
        .updateTable('estimateVersions')
        .set({ status: 'superseded' })
        .where('workOrderId', '=', order.id)
        .where('status', 'in', ['published', 'revision_requested'])
        .execute();

      await trx
        .updateTable('estimateVersions')
        .set({ status: 'published', publishedAt: now })
        .where('id', '=', version.id)
        .where('status', '=', 'draft')
        .execute();

      const scopeChange = order.status === 'in_repair' || order.status === 'awaiting_parts';
      await applyStatusChange(trx, {
        order,
        to: result.to,
        actor: 'workshop',
        actorUserId: userId,
        eventType: 'estimate_published',
        message: scopeChange
          ? `Mudança no serviço: orçamento ${versionLabel(versionNumber)} publicado. O trabalho alterado aguarda sua aprovação.`
          : `Orçamento ${versionLabel(versionNumber)} publicado para aprovação.`,
        now,
        patch: { needsParts: version.needsParts, expectedReadyAt: null },
      });
    });
  }

  async function discardDraft(workshopId: string, orderId: string): Promise<void> {
    const order = await loadOrder(workshopId, orderId);
    await db.transaction().execute(async (trx) => {
      const draft = await trx
        .selectFrom('estimateVersions')
        .select('id')
        .where('workOrderId', '=', order.id)
        .where('status', '=', 'draft')
        .executeTakeFirst();
      if (!draft) return;
      await trx.deleteFrom('estimateItems').where('estimateVersionId', '=', draft.id).execute();
      await trx.deleteFrom('estimateVersions').where('id', '=', draft.id).where('status', '=', 'draft').execute();
    });
  }

  return { saveDraft, publish, discardDraft };
}

export type EstimatesService = ReturnType<typeof createEstimatesService>;
