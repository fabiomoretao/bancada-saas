import { nextStatus, type CustomerDecision, type EstimateStatus, type PublicWorkOrderDTO } from '@bancada/shared';
import type { DB } from '../../db/client';
import { addBusinessDays } from '../../lib/business-days';
import { AppError, conflict } from '../../lib/errors';
import { nowIso } from '../../lib/ids';
import { hashToken, looksLikeToken, safeEqualHex } from '../../lib/tokens';
import * as repo from '../work-orders/work-orders.repository';
import { pickCurrentEstimate, toEstimateDTO } from '../work-orders/work-orders.mapper';
import { applyStatusChange } from '../work-orders/status-change';
import { versionLabel } from '../estimates/estimates.service';

const DECISION_RESULT: Record<CustomerDecision, EstimateStatus> = {
  approve: 'approved',
  request_revision: 'revision_requested',
  decline: 'rejected',
};

/** Mesma resposta para token malformado, inexistente ou revogado: não revela qual é o caso. */
const unavailable = () => new AppError(404, 'link_unavailable', 'Este link é inválido, foi substituído ou a ordem não está disponível.');

export function createPublicTrackingService({ db }: { db: DB }) {
  async function resolveOrderId(token: string): Promise<string> {
    if (!looksLikeToken(token)) throw unavailable();
    const hash = hashToken(token);

    const row = await db
      .selectFrom('publicAccessTokens')
      .select(['id', 'workOrderId', 'tokenHash'])
      .where('tokenHash', '=', hash)
      .where('revokedAt', 'is', null)
      .executeTakeFirst();
    if (!row || !safeEqualHex(row.tokenHash, hash)) throw unavailable();

    await db.updateTable('publicAccessTokens').set({ lastUsedAt: nowIso() }).where('id', '=', row.id).execute();
    return row.workOrderId;
  }

  /**
   * Monta a visão do cliente com seleção explícita de campos (lista de
   * permissão): telefone, e-mail, número de série e eventos internos nunca
   * entram aqui.
   */
  async function getPublicOrder(token: string): Promise<PublicWorkOrderDTO> {
    const workOrderId = await resolveOrderId(token);

    const order = await db
      .selectFrom('workOrders as wo')
      .innerJoin('instruments as i', 'i.id', 'wo.instrumentId')
      .innerJoin('workshops as w', 'w.id', 'wo.workshopId')
      .select([
        'wo.code',
        'wo.status',
        'wo.createdAt',
        'w.name as workshopName',
        'i.type as instrumentType',
        'i.brand as instrumentBrand',
        'i.model as instrumentModel',
      ])
      .where('wo.id', '=', workOrderId)
      .executeTakeFirst();
    if (!order) throw unavailable();

    const [estimates, events] = await Promise.all([
      repo.listEstimates(db, workOrderId),
      repo.listEvents(db, workOrderId, true),
    ]);
    const current = pickCurrentEstimate(estimates);

    return {
      code: order.code,
      status: order.status,
      workshopName: order.workshopName,
      instrument: { type: order.instrumentType, brand: order.instrumentBrand, model: order.instrumentModel },
      createdAt: order.createdAt,
      currentEstimate: current ? toEstimateDTO(current) : null,
      timeline: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        toStatus: e.toStatus,
        message: e.message,
        createdAt: e.createdAt,
      })),
      canDecide: order.status === 'awaiting_approval' && current?.status === 'published',
    };
  }

  /**
   * Decisão do cliente sobre a versão vigente do orçamento.
   * - Só vale para a versão publicada mais recente, enquanto aguarda decisão.
   * - Idempotente: reenviar a mesma decisão (duplo clique, recarregar a página)
   *   não cria uma segunda aprovação nem um segundo evento.
   */
  async function decide(
    token: string,
    input: { decision: CustomerDecision; versionNumber: number; message?: string },
  ): Promise<PublicWorkOrderDTO> {
    const workOrderId = await resolveOrderId(token);

    await db.transaction().execute(async (trx) => {
      const order = await trx.selectFrom('workOrders').select(['id', 'status']).where('id', '=', workOrderId).executeTakeFirst();
      if (!order) throw unavailable();

      const estimates = await repo.listEstimates(trx, workOrderId);
      const target = estimates.find((e) => e.versionNumber === input.versionNumber);
      if (!target) throw new AppError(404, 'estimate_not_found', 'Esta versão do orçamento não existe.');

      if (target.status === DECISION_RESULT[input.decision]) return; // mesma decisão repetida: nada a fazer

      const current = pickCurrentEstimate(estimates);
      if (target.status !== 'published' || current?.id !== target.id || order.status !== 'awaiting_approval') {
        throw conflict(
          'estimate_not_current',
          'Esta versão do orçamento não está mais aguardando decisão. Recarregue a página para ver a situação atual.',
        );
      }

      const needsParts = target.needsParts === 1;
      const result = nextStatus(order.status, input.decision, { needsParts });
      if (!result.ok) throw new AppError(409, 'invalid_transition', result.reason);

      const now = nowIso();
      const updated = await trx
        .updateTable('estimateVersions')
        .set({ status: DECISION_RESULT[input.decision], decisionAt: now, decisionMessage: input.message ?? null })
        .where('id', '=', target.id)
        .where('status', '=', 'published')
        .executeTakeFirst();
      if (Number(updated.numUpdatedRows) === 0) {
        throw conflict('estimate_not_current', 'Esta versão já recebeu uma decisão. Recarregue a página.');
      }

      const label = versionLabel(target.versionNumber);
      const message =
        input.decision === 'approve'
          ? `Orçamento ${label} aprovado pelo cliente.${needsParts ? ' A oficina aguarda a chegada da peça.' : ''}`
          : input.decision === 'request_revision'
            ? `Revisão pedida para ${label}: “${input.message}”`
            : `Serviço recusado pelo cliente.${input.message ? ` Motivo: “${input.message}”` : ''}`;

      await applyStatusChange(trx, {
        order,
        to: result.to,
        actor: 'customer',
        eventType: 'customer_decision',
        message,
        now,
        patch:
          result.to === 'in_repair' && target.estimatedBusinessDays
            ? { expectedReadyAt: addBusinessDays(new Date(now), target.estimatedBusinessDays) }
            : undefined,
      });
    });

    return getPublicOrder(token);
  }

  return { getPublicOrder, decide };
}

export type PublicTrackingService = ReturnType<typeof createPublicTrackingService>;
