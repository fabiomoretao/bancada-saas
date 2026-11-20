import { Router } from 'express';
import { changePlanSchema } from '@bancada/shared';
import { requireOwner } from '../../middleware/auth';
import { parseOrThrow } from '../../middleware/validate';
import { getWorkshopId } from '../../middleware/workshop-context';
import type { WorkshopService } from './workshop.service';

/** Plano da oficina: todos veem; só o responsável troca. */
export function workshopRouter(service: WorkshopService): Router {
  const router = Router();

  router.get('/plan', async (_req, res) => {
    res.json(await service.getPlan(getWorkshopId(res)));
  });

  router.put('/plan', requireOwner, async (req, res) => {
    const data = parseOrThrow(changePlanSchema, req.body);
    res.json(await service.changePlan(getWorkshopId(res), data));
  });

  return router;
}
