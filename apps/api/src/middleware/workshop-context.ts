import type { RequestHandler, Response } from 'express';

/**
 * Define qual oficina está fazendo a requisição.
 *
 * MODO DEMONSTRAÇÃO: não há login, então toda requisição usa a oficina fixa
 * DEMO_WORKSHOP_ID. Isso NÃO é seguro para produção. Quando houver
 * autenticação, este é o único middleware a trocar: ele passará a ler a
 * oficina da sessão/usuário autenticado. Repositórios e serviços já recebem
 * o workshopId explicitamente e filtram todas as consultas por ele.
 */
export function demoWorkshopContext(demoWorkshopId: string): RequestHandler {
  return (_req, res, next) => {
    res.locals.workshopId = demoWorkshopId;
    next();
  };
}

export function getWorkshopId(res: Response): string {
  const workshopId: unknown = res.locals.workshopId;
  if (typeof workshopId !== 'string' || !workshopId) {
    throw new Error('workshopContext não foi aplicado a esta rota.');
  }
  return workshopId;
}
