import type { Response } from 'express';

/** Oficina da sessão atual (definida pelo requireAuth). */
export function getWorkshopId(res: Response): string {
  const workshopId: unknown = res.locals.workshopId;
  if (typeof workshopId !== 'string' || !workshopId) {
    throw new Error('requireAuth não foi aplicado a esta rota.');
  }
  return workshopId;
}
