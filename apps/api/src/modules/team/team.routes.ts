import { Router } from 'express';
import { createUserSchema, updateUserSchema } from '@bancada/shared';
import { getAuth, requireOwner } from '../../middleware/auth';
import { parseOrThrow } from '../../middleware/validate';
import { getWorkshopId } from '../../middleware/workshop-context';
import type { TeamService } from './team.service';

/** Equipe: todos veem quem tem acesso; só o responsável cadastra e altera. */
export function teamRouter(service: TeamService): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ items: await service.list(getWorkshopId(res)) });
  });

  router.post('/', requireOwner, async (req, res) => {
    const data = parseOrThrow(createUserSchema, req.body);
    res.status(201).json(await service.create(getAuth(res), data));
  });

  router.patch('/:id', requireOwner, async (req, res) => {
    const data = parseOrThrow(updateUserSchema, req.body);
    res.json(await service.update(getAuth(res), String(req.params.id), data));
  });

  return router;
}
