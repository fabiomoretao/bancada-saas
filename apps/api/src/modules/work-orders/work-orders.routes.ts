import { Router } from 'express';
import { createWorkOrderSchema, listWorkOrdersQuerySchema, noteSchema, transitionSchema } from '@bancada/shared';
import { parseOrThrow } from '../../middleware/validate';
import { getWorkshopId } from '../../middleware/workshop-context';
import { getUserId } from '../../middleware/auth';
import type { WorkOrdersService } from './work-orders.service';

/** Rotas da oficina. Controladores finos: validam, chamam o serviço e respondem. */
export function workOrdersRouter(service: WorkOrdersService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const filters = parseOrThrow(listWorkOrdersQuerySchema, req.query);
    res.json(await service.list(getWorkshopId(res), filters));
  });

  router.post('/', async (req, res) => {
    const data = parseOrThrow(createWorkOrderSchema, req.body);
    res.status(201).json(await service.create(getWorkshopId(res), data, getUserId(res)));
  });

  router.get('/:id', async (req, res) => {
    res.json(await service.getDetail(getWorkshopId(res), req.params.id));
  });

  router.post('/:id/public-link', async (req, res) => {
    res.status(201).json(await service.regeneratePublicLink(getWorkshopId(res), req.params.id, getUserId(res)));
  });

  router.post('/:id/transitions', async (req, res) => {
    const input = parseOrThrow(transitionSchema, req.body);
    res.json(await service.transition(getWorkshopId(res), req.params.id, input, getUserId(res)));
  });

  router.post('/:id/events', async (req, res) => {
    const input = parseOrThrow(noteSchema, req.body);
    res.status(201).json(await service.addNote(getWorkshopId(res), req.params.id, input, getUserId(res)));
  });

  return router;
}
