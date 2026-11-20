import { Router } from 'express';
import { listInstrumentsQuerySchema } from '@bancada/shared';
import { parseOrThrow } from '../../middleware/validate';
import { getWorkshopId } from '../../middleware/workshop-context';
import type { InstrumentsService } from './instruments.service';

export function instrumentsRouter(service: InstrumentsService): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    const { query } = parseOrThrow(listInstrumentsQuerySchema, req.query);
    res.json(await service.list(getWorkshopId(res), query));
  });
  router.get('/:id', async (req, res) => {
    res.json(await service.getDetail(getWorkshopId(res), req.params.id));
  });
  return router;
}
