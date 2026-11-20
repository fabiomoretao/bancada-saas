import cors from 'cors';
import express from 'express';
import type { AppConfig } from './config';
import type { DB } from './db/client';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { originCheck } from './middleware/origin-check';
import { authRouter } from './modules/auth/auth.routes';
import { createAuthService } from './modules/auth/auth.service';
import { customersRouter } from './modules/customers/customers.routes';
import { createCustomersService } from './modules/customers/customers.service';
import { estimatesRouter } from './modules/estimates/estimates.routes';
import { createEstimatesService } from './modules/estimates/estimates.service';
import { instrumentsRouter } from './modules/instruments/instruments.routes';
import { createInstrumentsService } from './modules/instruments/instruments.service';
import { publicTrackingRouter } from './modules/public-tracking/public-tracking.routes';
import { createPublicTrackingService } from './modules/public-tracking/public-tracking.service';
import { teamRouter } from './modules/team/team.routes';
import { createTeamService } from './modules/team/team.service';
import { workshopRouter } from './modules/workshop/workshop.routes';
import { createWorkshopService } from './modules/workshop/workshop.service';
import { workOrdersRouter } from './modules/work-orders/work-orders.routes';
import { createWorkOrdersService } from './modules/work-orders/work-orders.service';

/**
 * Monta a aplicação recebendo as dependências (banco e configuração).
 * Os testes criam a app com um banco em memória pelo mesmo caminho.
 */
export function createApp({ db, config }: { db: DB; config: AppConfig }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', originCheck(config.WEB_ORIGIN));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const auth = createAuthService({ db, sessionDays: config.SESSION_DAYS });
  const workOrders = createWorkOrdersService({ db, tokenKey: config.TOKEN_ENCRYPTION_KEY });
  const estimates = createEstimatesService({ db });
  const customers = createCustomersService({ db });
  const instruments = createInstrumentsService({ db });
  const team = createTeamService({ db });
  const workshop = createWorkshopService({ db });
  const publicTracking = createPublicTrackingService({ db });

  // Conta: criar, entrar, sair e sessão atual.
  app.use('/api/auth', authRouter(auth, { secureCookies: config.NODE_ENV === 'production' }));

  // Área da oficina: exige login; cada consulta é filtrada pela oficina da sessão.
  const signedIn = requireAuth(auth);
  app.use('/api/work-orders/:id/estimates', signedIn, estimatesRouter(estimates, workOrders));
  app.use('/api/work-orders', signedIn, workOrdersRouter(workOrders));
  app.use('/api/customers', signedIn, customersRouter(customers));
  app.use('/api/instruments', signedIn, instrumentsRouter(instruments));
  app.use('/api/team', signedIn, teamRouter(team));
  app.use('/api/workshop', signedIn, workshopRouter(workshop));

  // Cliente final: sem conta, autorizado apenas pelo token do link privado.
  app.use('/api/public', publicTrackingRouter(publicTracking));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
