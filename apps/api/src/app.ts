import cors from 'cors';
import express from 'express';
import type { AppConfig } from './config';
import type { DB } from './db/client';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { demoWorkshopContext } from './middleware/workshop-context';
import { estimatesRouter } from './modules/estimates/estimates.routes';
import { createEstimatesService } from './modules/estimates/estimates.service';
import { publicTrackingRouter } from './modules/public-tracking/public-tracking.routes';
import { createPublicTrackingService } from './modules/public-tracking/public-tracking.service';
import { workOrdersRouter } from './modules/work-orders/work-orders.routes';
import { createWorkOrdersService } from './modules/work-orders/work-orders.service';

/**
 * Monta a aplicação recebendo as dependências (banco e configuração).
 * Os testes criam a app com um banco em memória pelo mesmo caminho.
 */
export function createApp({ db, config }: { db: DB; config: AppConfig }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.WEB_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const workOrders = createWorkOrdersService({ db, tokenKey: config.TOKEN_ENCRYPTION_KEY });
  const estimates = createEstimatesService({ db });
  const publicTracking = createPublicTrackingService({ db });

  // Rotas da oficina: sempre com contexto de oficina (hoje, modo demonstração).
  const workshopContext = demoWorkshopContext(config.DEMO_WORKSHOP_ID);
  app.use('/api/work-orders/:id/estimates', workshopContext, estimatesRouter(estimates, workOrders));
  app.use('/api/work-orders', workshopContext, workOrdersRouter(workOrders));

  // Rotas do cliente: autorizadas apenas pelo token do link privado.
  app.use('/api/public', publicTrackingRouter(publicTracking));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
