import { Router } from 'express';
import { saveEstimateDraftSchema } from '@bancada/shared';
import { z } from 'zod';
import { parseOrThrow } from '../../middleware/validate';
import { getWorkshopId } from '../../middleware/workshop-context';
import { getUserId } from '../../middleware/auth';
import type { WorkOrdersService } from '../work-orders/work-orders.service';
import type { EstimatesService } from './estimates.service';

const versionParam = z.coerce.number().int().min(1);

/** Montado em /api/work-orders/:id/estimates. Toda resposta devolve a OS atualizada. */
export function estimatesRouter(estimates: EstimatesService, workOrders: WorkOrdersService): Router {
  const router = Router({ mergeParams: true });

  // Cria ou atualiza o rascunho (só existe um por vez).
  router.put('/draft', async (req, res) => {
    const workshopId = getWorkshopId(res);
    const data = parseOrThrow(saveEstimateDraftSchema, req.body);
    const params = req.params as { id: string };
    await estimates.saveDraft(workshopId, params.id, data);
    res.json(await workOrders.getDetail(workshopId, params.id));
  });

  router.delete('/draft', async (req, res) => {
    const workshopId = getWorkshopId(res);
    const params = req.params as { id: string };
    await estimates.discardDraft(workshopId, params.id);
    res.json(await workOrders.getDetail(workshopId, params.id));
  });

  router.post('/:version/publish', async (req, res) => {
    const workshopId = getWorkshopId(res);
    const params = req.params as { id: string; version: string };
    const version = parseOrThrow(versionParam, params.version);
    await estimates.publish(workshopId, params.id, version, getUserId(res));
    res.json(await workOrders.getDetail(workshopId, params.id));
  });

  return router;
}
