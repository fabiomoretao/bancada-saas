import { Router } from 'express';
import { customerSchema, duplicateCheckQuerySchema, listCustomersQuerySchema } from '@bancada/shared';
import { parseOrThrow } from '../../middleware/validate';
import { getWorkshopId } from '../../middleware/workshop-context';
import type { CustomersService } from './customers.service';

/** Rotas de clientes. Só existem na área da oficina; nada disso é exposto no link público. */
export function customersRouter(service: CustomersService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { query } = parseOrThrow(listCustomersQuerySchema, req.query);
    res.json(await service.list(getWorkshopId(res), query));
  });

  // Aviso de duplicidade enquanto a pessoa digita (não bloqueia nada).
  router.get('/duplicates', async (req, res) => {
    const { phone, email, excludeId } = parseOrThrow(duplicateCheckQuerySchema, req.query);
    res.json({ items: await service.findDuplicates(getWorkshopId(res), { phone, email }, excludeId) });
  });

  router.post('/', async (req, res) => {
    const data = parseOrThrow(customerSchema, req.body);
    res.status(201).json(await service.create(getWorkshopId(res), data));
  });

  router.get('/:id', async (req, res) => {
    res.json(await service.getDetail(getWorkshopId(res), req.params.id));
  });

  router.put('/:id', async (req, res) => {
    const data = parseOrThrow(customerSchema, req.body);
    res.json(await service.update(getWorkshopId(res), req.params.id, data));
  });

  return router;
}
