import { Router } from 'express';
import { customerDecisionSchema } from '@bancada/shared';
import { parseOrThrow } from '../../middleware/validate';
import type { PublicTrackingService } from './public-tracking.service';

/** Rotas do cliente. Não passam pelo contexto da oficina: o token é a credencial. */
export function publicTrackingRouter(service: PublicTrackingService): Router {
  const router = Router();

  router.get('/orders/:token', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.json(await service.getPublicOrder(req.params.token));
  });

  router.post('/orders/:token/decision', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const input = parseOrThrow(customerDecisionSchema, req.body);
    res.json(await service.decide(req.params.token, input));
  });

  return router;
}
