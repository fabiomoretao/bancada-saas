import type { EstimateDTO, WorkOrderEventDTO } from '@bancada/shared';
import type { EstimateItemRow, EstimateVersionRow, WorkOrderEventRow } from '../../db/schema';

export type EstimateWithItems = EstimateVersionRow & { items: EstimateItemRow[] };

export function toEstimateDTO(row: EstimateWithItems): EstimateDTO {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    diagnosis: row.diagnosis,
    needsParts: row.needsParts === 1,
    estimatedBusinessDays: row.estimatedBusinessDays,
    items: row.items.map((item) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    })),
    totalCents: row.totalCents,
    publishedAt: row.publishedAt,
    decisionAt: row.decisionAt,
    decisionMessage: row.decisionMessage,
  };
}

export function toEventDTO(row: WorkOrderEventRow & { actorName?: string | null }): WorkOrderEventDTO {
  return {
    id: row.id,
    actorType: row.actorType,
    eventType: row.eventType,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    message: row.message,
    visibility: row.visibility,
    createdAt: row.createdAt,
    actorName: row.actorName ?? null,
  };
}

/**
 * Orçamento vigente: a versão mais recente que já saiu do rascunho.
 * Versões substituídas continuam no histórico.
 */
export function pickCurrentEstimate(estimates: EstimateWithItems[]): EstimateWithItems | null {
  const visible = estimates.filter((e) => e.status !== 'draft' && e.status !== 'superseded');
  return visible.at(-1) ?? null;
}

export function pickDraftEstimate(estimates: EstimateWithItems[]): EstimateWithItems | null {
  return estimates.findLast((e) => e.status === 'draft') ?? null;
}
